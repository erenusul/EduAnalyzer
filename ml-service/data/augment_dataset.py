"""
Script to augment the question dataset
"""
import json
import sys
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from ml_service.data.augmentation import DataAugmenter
from ml_service.config import (
    QUESTION_DATASET_PATH,
    DATA_DIR,
)


def augment_question_dataset(
    input_path: Path = None,
    output_path: Path = None,
    augmentation_factor: int = 2,
    method: str = "random",
):
    """
    Augment question dataset
    
    Args:
        input_path: Path to input dataset JSON
        output_path: Path to save augmented dataset
        augmentation_factor: How many times to augment each question
        method: Augmentation method
    """
    if input_path is None:
        input_path = QUESTION_DATASET_PATH
    
    if output_path is None:
        output_path = DATA_DIR / "question_dataset_augmented.json"
    
    print(f"Loading dataset from {input_path}...")
    with open(input_path, "r", encoding="utf-8") as f:
        data = json.load(f)
    
    questions = data.get("questions", [])
    print(f"Original dataset: {len(questions)} questions")
    
    # Extract texts and topics
    texts = [q["question_text"] for q in questions]
    topics = [q["topic"] for q in questions]
    
    # Augment
    print(f"Augmenting with factor {augmentation_factor}, method: {method}...")
    augmenter = DataAugmenter(augmentation_factor=augmentation_factor)
    augmented_texts, augmented_topics = augmenter.augment_dataset(
        texts, topics, method=method
    )
    
    print(f"Augmented dataset: {len(augmented_texts)} questions")
    print(f"Expansion ratio: {len(augmented_texts) / len(questions):.2f}x")
    
    # Create augmented questions
    augmented_questions = []
    for i, (text, topic) in enumerate(zip(augmented_texts, augmented_topics)):
        # Find original question for metadata
        original_idx = i % len(questions)
        original_q = questions[original_idx]
        
        augmented_q = {
            "question_id": f"{original_q['question_id']}_aug_{i // len(questions)}",
            "question_text": text,
            "options": original_q.get("options", []),
            "topic": topic,
            "correct_answer": original_q.get("correct_answer"),
            "exam_info": original_q.get("exam_info"),
            "question_number": original_q.get("question_number"),
            "source_pdf": original_q.get("source_pdf"),
            "is_augmented": True,
        }
        augmented_questions.append(augmented_q)
    
    # Create augmented dataset
    augmented_data = {
        "total_questions": len(augmented_questions),
        "topics": list(set(augmented_topics)),
        "questions": augmented_questions,
        "original_count": len(questions),
        "augmentation_factor": augmentation_factor,
        "augmentation_method": method,
    }
    
    # Save
    output_path.parent.mkdir(parents=True, exist_ok=True)
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(augmented_data, f, ensure_ascii=False, indent=2)
    
    print(f"Augmented dataset saved to {output_path}")
    
    # Print statistics
    from collections import Counter
    topic_counts = Counter(augmented_topics)
    print("\nTopic distribution:")
    for topic, count in topic_counts.most_common():
        print(f"  {topic}: {count} questions")


if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description="Augment question dataset")
    parser.add_argument(
        "--factor",
        type=int,
        default=2,
        help="Augmentation factor (default: 2)",
    )
    parser.add_argument(
        "--method",
        type=str,
        default="random",
        choices=["synonym", "reformulation", "contextual", "random"],
        help="Augmentation method (default: random)",
    )
    parser.add_argument(
        "--output",
        type=str,
        default=None,
        help="Output file path (default: question_dataset_augmented.json)",
    )
    
    args = parser.parse_args()
    
    augment_question_dataset(
        augmentation_factor=args.factor,
        method=args.method,
        output_path=Path(args.output) if args.output else None,
    )









