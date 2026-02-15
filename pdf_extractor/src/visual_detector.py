"""
Visual content detection and description for questions
Detects visual elements (graphs, tables, images) in questions and adds descriptions
"""
import re
from typing import Dict, List, Optional, Tuple


class VisualDetector:
    """
    Detects visual content in question texts and adds descriptions
    """
    
    def __init__(self):
        """Initialize visual detector"""
        # Visual indicator keywords
        self.visual_keywords = {
            "grafik": ["grafik", "grafiği", "grafikte", "grafikten", "grafiğe göre"],
            "tablo": ["tablo", "tablosu", "tabloda", "tablodan", "tabloya göre"],
            "şekil": ["şekil", "şekli", "şekilde", "şekilden", "şekle göre"],
            "resim": ["resim", "resmi", "resimde", "resimden", "resme göre"],
            "görsel": ["görsel", "görseli", "görselde", "görselden", "görsele göre"],
            "diyagram": ["diyagram", "diyagramı", "diyagramda", "diyagramdan"],
            "harita": ["harita", "haritası", "haritada", "haritadan"],
            "çizelge": ["çizelge", "çizelgesi", "çizelgede", "çizelgeden"],
        }
        
        # Visual reference patterns
        self.visual_patterns = [
            r'yukarıdaki\s+(grafik|tablo|şekil|resim|görsel)',
            r'aşağıdaki\s+(grafik|tablo|şekil|resim|görsel)',
            r'verilen\s+(grafik|tablo|şekil|resim|görsel)',
            r'bu\s+(grafik|tablo|şekil|resim|görsel)',
            r'şekildeki\s+(grafik|tablo|şekil|resim|görsel)',
            r'görseldeki\s+(grafik|tablo|şekil|resim|görsel)',
        ]
    
    def detect_visual_content(self, text: str) -> Dict[str, any]:
        """
        Detect visual content in question text
        
        Args:
            text: Question text
            
        Returns:
            Dictionary with visual detection results
        """
        text_lower = text.lower()
        
        detected_types = []
        visual_references = []
        
        # Check for visual keywords
        for visual_type, keywords in self.visual_keywords.items():
            for keyword in keywords:
                if keyword in text_lower:
                    if visual_type not in detected_types:
                        detected_types.append(visual_type)
                    break
        
        # Check for visual reference patterns
        for pattern in self.visual_patterns:
            matches = re.findall(pattern, text_lower, re.IGNORECASE)
            if matches:
                for match in matches:
                    if isinstance(match, tuple):
                        visual_type = match[0] if match else None
                    else:
                        visual_type = match
                    if visual_type and visual_type not in detected_types:
                        detected_types.append(visual_type)
                    visual_references.append(match)
        
        # Determine primary visual type
        primary_type = None
        if detected_types:
            # Priority: grafik > tablo > şekil > resim > görsel
            priority_order = ["grafik", "tablo", "şekil", "resim", "görsel", "diyagram", "harita", "çizelge"]
            for vtype in priority_order:
                if vtype in detected_types:
                    primary_type = vtype
                    break
        
        return {
            "has_visual": len(detected_types) > 0,
            "visual_types": detected_types,
            "primary_type": primary_type,
            "visual_references": visual_references,
            "visual_count": len(detected_types),
        }
    
    def add_visual_description(self, text: str, visual_info: Optional[Dict] = None) -> str:
        """
        Add visual description prefix to question text
        
        Args:
            text: Original question text
            visual_info: Visual detection results (if None, will detect automatically)
            
        Returns:
            Text with visual description added
        """
        if visual_info is None:
            visual_info = self.detect_visual_content(text)
        
        if not visual_info["has_visual"]:
            return text
        
        # Create visual description tag
        primary_type = visual_info["primary_type"]
        if primary_type:
            # Capitalize first letter
            visual_tag = f"[{primary_type.upper()}]"
        else:
            visual_tag = "[GÖRSEL]"
        
        # Add visual count if multiple visuals
        if visual_info["visual_count"] > 1:
            visual_tag += f" ({visual_info['visual_count']} adet)"
        
        # Add tag at the beginning of question
        # But preserve question number if exists
        question_num_match = re.match(r'^(\d+[-\.]\s*)', text)
        if question_num_match:
            # Insert after question number
            question_num = question_num_match.group(1)
            rest_text = text[len(question_num):].strip()
            return f"{question_num}{visual_tag} {rest_text}"
        else:
            return f"{visual_tag} {text}"
    
    def enhance_question_text(self, text: str) -> Tuple[str, Dict]:
        """
        Enhance question text with visual descriptions
        
        Args:
            text: Original question text
            
        Returns:
            Tuple of (enhanced_text, visual_info)
        """
        visual_info = self.detect_visual_content(text)
        enhanced_text = self.add_visual_description(text, visual_info)
        
        return enhanced_text, visual_info


def detect_and_enhance_questions(questions: List[Dict]) -> List[Dict]:
    """
    Detect visual content in questions and enhance them
    
    Args:
        questions: List of question dictionaries
        
    Returns:
        Enhanced questions with visual descriptions
    """
    detector = VisualDetector()
    enhanced_questions = []
    
    visual_count = 0
    
    for question in questions:
        question_text = question.get("question_text", "")
        
        if not question_text:
            enhanced_questions.append(question)
            continue
        
        enhanced_text, visual_info = detector.enhance_question_text(question_text)
        
        # Update question
        enhanced_question = question.copy()
        enhanced_question["question_text"] = enhanced_text
        enhanced_question["has_visual"] = visual_info["has_visual"]
        enhanced_question["visual_type"] = visual_info.get("primary_type")
        
        if visual_info["has_visual"]:
            visual_count += 1
        
        enhanced_questions.append(enhanced_question)
    
    print(f"✓ {visual_count} görsel içeren soru tespit edildi ve işlendi")
    
    return enhanced_questions
