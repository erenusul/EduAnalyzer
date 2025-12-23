"""
BERTurk-based classifier for question classification
"""
import json
from pathlib import Path
from typing import Dict, List, Optional, Tuple

import torch
import torch.nn as nn
from transformers import (
    AutoModel,
    AutoTokenizer,
    AutoModelForSequenceClassification,
)

from ml_service.config import (
    BERT_MODEL_NAME,
    MAX_SEQUENCE_LENGTH,
    CHECKPOINTS_DIR,
    DEVICE,
    SUBJECTS,
    SUBJECT_TOPICS,
    TOPIC_TO_SUBJECT,
    SUBJECT_MODEL_NAME,
    TOPIC_MODEL_NAME,
)
from ml_service.data.preprocessor import TextPreprocessor


class BERTurkClassifier(nn.Module):
    """
    Improved BERTurk-based classifier with deeper architecture
    """

    def __init__(
        self,
        model_name: str = BERT_MODEL_NAME,
        num_labels: int = 2,
        dropout: float = 0.3,  # Increased dropout for better regularization
        hidden_size: int = 384,  # Increased hidden size for better capacity
        use_attention_pooling: bool = True,  # Enable attention pooling for better performance
    ):
        """
        Initialize classifier
        
        Args:
            model_name: Hugging Face model name
            num_labels: Number of classification labels
            dropout: Dropout rate
            hidden_size: Hidden layer size for classification head
            use_attention_pooling: Use attention-weighted pooling instead of pooler_output
        """
        super().__init__()
        self.model_name = model_name
        self.num_labels = num_labels
        self.use_attention_pooling = use_attention_pooling
        
        # Load BERTurk model
        print(f"Loading BERTurk model '{model_name}' (this may take a while on first run)...", flush=True)
        self.bert = AutoModel.from_pretrained(model_name)
        print("BERTurk model loaded successfully.", flush=True)
        bert_hidden_size = self.bert.config.hidden_size
        
        # Attention pooling layer (optional)
        if use_attention_pooling:
            self.attention = nn.Linear(bert_hidden_size, 1)
        
        # Deeper classification head
        self.dropout1 = nn.Dropout(dropout)
        self.dropout2 = nn.Dropout(dropout)
        
        # First hidden layer
        self.fc1 = nn.Linear(bert_hidden_size, hidden_size)
        self.layer_norm1 = nn.LayerNorm(hidden_size)
        
        # Second hidden layer
        self.fc2 = nn.Linear(hidden_size, hidden_size // 2)
        self.layer_norm2 = nn.LayerNorm(hidden_size // 2)
        
        # Output layer
        self.classifier = nn.Linear(hidden_size // 2, num_labels)

    def attention_pooling(
        self,
        hidden_states: torch.Tensor,
        attention_mask: torch.Tensor,
    ) -> torch.Tensor:
        """
        Attention-weighted pooling
        
        Args:
            hidden_states: Hidden states from BERT [batch_size, seq_len, hidden_size]
            attention_mask: Attention mask [batch_size, seq_len]
            
        Returns:
            Pooled representation [batch_size, hidden_size]
        """
        # Compute attention weights
        attention_weights = self.attention(hidden_states).squeeze(-1)  # [batch_size, seq_len]
        
        # Mask out padding tokens
        attention_weights = attention_weights.masked_fill(
            attention_mask == 0, float('-inf')
        )
        attention_weights = torch.softmax(attention_weights, dim=-1)
        
        # Weighted sum
        pooled = torch.sum(hidden_states * attention_weights.unsqueeze(-1), dim=1)
        
        return pooled

    def forward(
        self,
        input_ids: torch.Tensor,
        attention_mask: torch.Tensor,
        labels: Optional[torch.Tensor] = None,
    ) -> Dict[str, torch.Tensor]:
        """
        Forward pass
        
        Args:
            input_ids: Tokenized input IDs
            attention_mask: Attention mask
            labels: Optional labels for training
            
        Returns:
            Dictionary with logits and optionally loss
        """
        outputs = self.bert(input_ids=input_ids, attention_mask=attention_mask)
        
        # Use attention pooling or pooler output
        if self.use_attention_pooling:
            pooled_output = self.attention_pooling(
                outputs.last_hidden_state,
                attention_mask,
            )
        else:
            pooled_output = outputs.pooler_output
        
        # First layer
        pooled_output = self.dropout1(pooled_output)
        hidden = self.fc1(pooled_output)
        hidden = self.layer_norm1(hidden)
        hidden = torch.relu(hidden)
        
        # Second layer
        hidden = self.dropout2(hidden)
        hidden = self.fc2(hidden)
        hidden = self.layer_norm2(hidden)
        hidden = torch.relu(hidden)
        
        # Output layer
        logits = self.classifier(hidden)
        
        result = {"logits": logits}
        
        if labels is not None:
            loss_fn = nn.CrossEntropyLoss()
            loss = loss_fn(logits, labels)
            result["loss"] = loss
        
        return result


class QuestionClassifier:
    """
    High-level classifier interface for question classification
    Supports both subject and topic prediction
    """

    def __init__(
        self,
        model_path: Optional[Path] = None,
        model_type: str = "combined",
        device: Optional[str] = None,
    ):
        """
        Initialize question classifier
        
        Args:
            model_path: Path to saved model checkpoint
            model_type: Type of model ("subject", "topic", or "combined")
            device: Device to run on ("cuda" or "cpu")
        """
        self.device = device or DEVICE
        self.model_type = model_type
        self.tokenizer = AutoTokenizer.from_pretrained(BERT_MODEL_NAME)
        self.preprocessor = TextPreprocessor()  # Instance for optional features
        
        # Initialize models
        self.subject_model: Optional[nn.Module] = None
        self.topic_model: Optional[nn.Module] = None
        self.combined_model: Optional[nn.Module] = None
        
        # Label mappings
        self.subject_labels: List[str] = []
        self.topic_labels: List[str] = []
        
        # Load model if path provided
        if model_path:
            self.load_model(model_path, model_type)

    def load_model(
        self,
        model_path: Path,
        model_type: str = "combined",
    ) -> None:
        """
        Load a trained model from checkpoint
        
        Args:
            model_path: Path to model checkpoint
            model_type: Type of model to load
        """
        # Handle combined model type first (it uses directory, not file)
        if model_type == "combined":
            # Load both models
            # If model_path is a directory, use it directly; otherwise use parent
            if model_path.is_dir():
                checkpoints_dir = model_path
            else:
                checkpoints_dir = model_path.parent
            
            subject_path = checkpoints_dir / SUBJECT_MODEL_NAME
            topic_path = checkpoints_dir / TOPIC_MODEL_NAME
            
            if subject_path.exists():
                self.load_model(subject_path, "subject")
            if topic_path.exists():
                self.load_model(topic_path, "topic")
            return
        
        if not model_path.exists():
            raise FileNotFoundError(f"Model file not found: {model_path}")
        
        checkpoint = torch.load(model_path, map_location=self.device)
        
        if model_type == "subject":
            # Get number of labels from checkpoint
            labels = checkpoint.get("labels", list(SUBJECTS.keys()))
            num_labels = len(labels)
            checkpoint_state = checkpoint["model_state_dict"]
            
            # Check if checkpoint has new architecture (fc1, layer_norm1, etc.)
            has_new_architecture = any("fc1" in key or "layer_norm1" in key for key in checkpoint_state.keys())
            
            # Create model
            self.subject_model = BERTurkClassifier(num_labels=num_labels)
            
            if not has_new_architecture:
                # Old checkpoint - filter out incompatible classifier layer
                # Keep BERT layers and other compatible parts
                filtered_state = {}
                for key, value in checkpoint_state.items():
                    # Skip classifier if it exists (will use random init from new architecture)
                    if "classifier" in key:
                        continue
                    filtered_state[key] = value
                
                # Load compatible parts (BERT layers)
                model_state = self.subject_model.state_dict()
                for key in filtered_state:
                    if key in model_state and model_state[key].shape == filtered_state[key].shape:
                        model_state[key] = filtered_state[key]
                self.subject_model.load_state_dict(model_state, strict=False)
            else:
                # New checkpoint - load with strict=False to handle any minor mismatches
                self.subject_model.load_state_dict(checkpoint_state, strict=False)
            
            self.subject_model.to(self.device)
            self.subject_model.eval()
            self.subject_labels = labels
        
        elif model_type == "topic":
            # Load topic labels from checkpoint or config
            topic_labels = checkpoint.get("labels", [])
            if not topic_labels:
                # Get all topics from config
                topic_labels = []
                for topics in SUBJECT_TOPICS.values():
                    topic_labels.extend(topics)
                topic_labels = sorted(list(set(topic_labels)))
            
            num_labels = len(topic_labels)
            checkpoint_state = checkpoint["model_state_dict"]
            
            # Check if checkpoint has new architecture (fc1, layer_norm1, etc.)
            has_new_architecture = any("fc1" in key or "layer_norm1" in key for key in checkpoint_state.keys())
            
            # Create model
            self.topic_model = BERTurkClassifier(num_labels=num_labels)
            
            if not has_new_architecture:
                # Old checkpoint - filter out incompatible classifier layer
                # Keep BERT layers and other compatible parts
                filtered_state = {}
                for key, value in checkpoint_state.items():
                    # Skip classifier if it exists (will use random init from new architecture)
                    if "classifier" in key:
                        continue
                    filtered_state[key] = value
                
                # Load compatible parts (BERT layers)
                model_state = self.topic_model.state_dict()
                for key in filtered_state:
                    if key in model_state and model_state[key].shape == filtered_state[key].shape:
                        model_state[key] = filtered_state[key]
                self.topic_model.load_state_dict(model_state, strict=False)
            else:
                # New checkpoint - load with strict=False to handle any minor mismatches
                self.topic_model.load_state_dict(checkpoint_state, strict=False)
            
            self.topic_model.to(self.device)
            self.topic_model.eval()
            self.topic_labels = topic_labels

    def predict_subject(
        self,
        text: str,
        top_k: int = 1,
    ) -> List[Tuple[str, float]]:
        """
        Predict subject for a question
        
        Args:
            text: Question text
            top_k: Number of top predictions to return
            
        Returns:
            List of (subject, confidence) tuples
        """
        if self.subject_model is None:
            raise ValueError("Subject model not loaded")
        
        # Preprocess and tokenize (use static method to avoid recursion)
        text = TextPreprocessor.preprocess(text)
        encoding = self.tokenizer(
            text,
            truncation=True,
            padding="max_length",
            max_length=MAX_SEQUENCE_LENGTH,
            return_tensors="pt",
        )
        
        input_ids = encoding["input_ids"].to(self.device)
        attention_mask = encoding["attention_mask"].to(self.device)
        
        # Predict
        with torch.no_grad():
            outputs = self.subject_model(input_ids=input_ids, attention_mask=attention_mask)
            logits = outputs["logits"]
            probabilities = torch.softmax(logits, dim=-1)
        
        # Get top k predictions
        top_probs, top_indices = torch.topk(probabilities[0], k=min(top_k, len(self.subject_labels)))
        
        results = [
            (self.subject_labels[idx.item()], prob.item())
            for prob, idx in zip(top_probs, top_indices)
        ]
        
        return results

    def predict_topic(
        self,
        text: str,
        subject: Optional[str] = None,
        top_k: int = 1,
    ) -> List[Tuple[str, float]]:
        """
        Predict topic for a question
        
        Args:
            text: Question text
            subject: Optional subject to filter topics
            top_k: Number of top predictions to return
            
        Returns:
            List of (topic, confidence) tuples
        """
        if self.topic_model is None:
            raise ValueError("Topic model not loaded")
        
        # Preprocess and tokenize (use static method to avoid recursion)
        text = TextPreprocessor.preprocess(text)
        encoding = self.tokenizer(
            text,
            truncation=True,
            padding="max_length",
            max_length=MAX_SEQUENCE_LENGTH,
            return_tensors="pt",
        )
        
        input_ids = encoding["input_ids"].to(self.device)
        attention_mask = encoding["attention_mask"].to(self.device)
        
        # Predict
        with torch.no_grad():
            outputs = self.topic_model(input_ids=input_ids, attention_mask=attention_mask)
            logits = outputs["logits"]
            probabilities = torch.softmax(logits, dim=-1)
        
        # Filter by subject if provided
        valid_indices = list(range(len(self.topic_labels)))
        if subject:
            subject_topics = SUBJECT_TOPICS.get(subject, [])
            valid_indices = [
                idx
                for idx, topic in enumerate(self.topic_labels)
                if topic in subject_topics
            ]
        
        if not valid_indices:
            valid_indices = list(range(len(self.topic_labels)))
        
        # Get top k predictions from valid topics
        valid_probs = probabilities[0][valid_indices]
        top_probs, top_local_indices = torch.topk(valid_probs, k=min(top_k, len(valid_indices)))
        
        results = [
            (self.topic_labels[valid_indices[idx.item()]], prob.item())
            for prob, idx in zip(top_probs, top_local_indices)
        ]
        
        return results

    def predict(
        self,
        text: str,
        top_k_subject: int = 1,
        top_k_topic: int = 1,
    ) -> Dict[str, List[Tuple[str, float]]]:
        """
        Predict both subject and topic
        
        Args:
            text: Question text
            top_k_subject: Number of top subject predictions
            top_k_topic: Number of top topic predictions
            
        Returns:
            Dictionary with subject and topic predictions
        """
        # Since all training data is Turkish, always predict Turkish as subject
        # In the future, when we have data for other subjects, we can use subject_model
        subject_predictions = [("turkce", 1.0)]
        
        # Use Turkish subject for topic prediction
        topic_predictions = self.predict_topic(text, subject="turkce", top_k=top_k_topic)
        
        # Apply keyword-based fallback for better accuracy
        topic_predictions = self._apply_keyword_fallback(text, topic_predictions)
        
        return {
            "subject": subject_predictions,
            "topic": topic_predictions,
        }
    
    def _apply_keyword_fallback(
        self,
        text: str,
        predictions: List[Tuple[str, float]],
    ) -> List[Tuple[str, float]]:
        """
        Apply keyword-based fallback to improve predictions
        
        Args:
            text: Question text (lowercase)
            predictions: Model predictions
            
        Returns:
            Adjusted predictions with keyword boost
        """
        text_lower = text.lower()
        
        # Keyword mappings for Turkish topics
        keyword_mappings = {
            "Söz Sanatları": [
                # Temel söz sanatları
                "benzetme", "teşbih", "mecaz", "istiare", "kinaye", "mübalağa",
                "tezat", "tenasüp", "tecahül", "hüsn-i talil", "teşhis", "intak",
                "söz sanatı", "edebi sanat", "sanat", "metafor", "kişileştirme",
                # Alt konular ve varyasyonlar
                "konuşturma", "abartma", "mübalağa", "teşbih-i beliğ", "istiare-i temsiliye",
                "istiare-i mekniye", "istiare-i mürekkebe", "kinaye-i mürekkebe",
                "teşhis-i mürsel", "intak-ı mürsel", "tecahül-i arif", "hüsn-i ta'lil",
                # Soru formatları
                "hangi söz sanatı", "söz sanatlarından hangisi", "hangi edebi sanat",
                "numaralanmış cümlelerden hangisinde", "hangi dizede", "hangi mısrada",
                "söz sanatı kullanılmıştır", "edebi sanat yapılmıştır", "hangi sanat",
                # Özel durumlar
                "şemsiye", "şemsiyeymişçesine", "gibi", "kadar", "sanki", "adeta"
            ],
            "Cümle Türleri": [
                "cümle türü", "fiil cümlesi", "isim cümlesi", "kurallı cümle",
                "devrik cümle", "basit cümle", "birleşik cümle", "sıralı cümle",
                "bağlı cümle", "yüklem", "cümle çeşidi"
            ],
            "Fiilimsiler": [
                "fiilimsi", "isim-fiil", "sıfat-fiil", "zarf-fiil", "ulaç",
                "ortaç", "eylemsi", "-ma/-me", "-mak/-mek", "-an/-en", "-dık/-dik"
            ],
            "Noktalama": [
                "nokta", "virgül", "noktalı virgül", "iki nokta", "üç nokta",
                "soru işareti", "ünlem işareti", "tırnak", "parantez", "noktalama"
            ],
            "Fiil Çatıları": [
                "fiil çatısı", "etken", "edilgen", "dönüşlü", "işteş",
                "geçişli", "geçişsiz", "oldurgan", "ettirgen", "çatı"
            ],
            "Yazım Kuralları": [
                "yazım", "imla", "yazım kuralı", "büyük harf", "küçük harf",
                "birleşik yazım", "ayrı yazım", "yazım hatası"
            ],
            "Metin Türleri": [
                "metin türü", "hikaye", "roman", "şiir", "masal", "fabl",
                "deneme", "makale", "fıkra", "anı", "günlük", "mektup",
                "biyografi", "otobiyografi", "röportaj", "haber"
            ],
            "Öge": [
                "öge", "cümlenin ögeleri", "yüklem", "özne", "nesne",
                "dolaylı tümleç", "zarf tümleci", "edat tümleci", "öge bulma"
            ],
        }
        
        # Check for keywords and boost matching predictions
        boosted_predictions = []
        for topic, confidence in predictions:
            boost = 0.0
            keywords = keyword_mappings.get(topic, [])
            
            # Count matching keywords (for Söz Sanatları, count multiple matches)
            matching_keywords = 0
            for keyword in keywords:
                if keyword in text_lower:
                    matching_keywords += 1
                    # For Söz Sanatları, apply stronger boost
                    if topic == "Söz Sanatları":
                        boost += 0.25  # Boost by 25% per keyword for Söz Sanatları
                    else:
                        boost += 0.15  # Boost by 15% per keyword for other topics
                    # For other topics, break after first match
                    if topic != "Söz Sanatları":
                        break
            
            # For Söz Sanatları, if multiple keywords match, apply extra boost
            if topic == "Söz Sanatları" and matching_keywords > 1:
                boost += 0.10  # Extra 10% boost for multiple keyword matches
            
            # Cap boost at 0.5 (50%) for Söz Sanatları, 0.3 (30%) for others
            max_boost = 0.5 if topic == "Söz Sanatları" else 0.3
            boost = min(boost, max_boost)
            new_confidence = min(confidence + boost, 1.0)
            boosted_predictions.append((topic, new_confidence))
        
        # Re-sort by confidence
        boosted_predictions.sort(key=lambda x: x[1], reverse=True)
        
        return boosted_predictions[:len(predictions)]

