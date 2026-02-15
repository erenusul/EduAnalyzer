"""
Advanced loss functions for question classification
"""
import torch
import torch.nn as nn
import torch.nn.functional as F
from typing import Optional


class FocalLoss(nn.Module):
    """
    Focal Loss for addressing class imbalance
    
    Focal Loss focuses learning on hard examples by down-weighting easy examples.
    This is particularly useful for imbalanced datasets.
    
    Paper: https://arxiv.org/abs/1708.02002
    """
    
    def __init__(
        self,
        alpha: Optional[torch.Tensor] = None,
        gamma: float = 2.0,
        reduction: str = 'mean',
        label_smoothing: float = 0.0,
    ):
        """
        Initialize Focal Loss
        
        Args:
            alpha: Weighting factor for each class (tensor of shape [num_classes])
                   If None, uniform weighting is used
            gamma: Focusing parameter (default: 2.0)
                   Higher gamma focuses more on hard examples
            reduction: Reduction method ('mean', 'sum', or 'none')
            label_smoothing: Label smoothing factor (0.0 = no smoothing)
        """
        super().__init__()
        self.gamma = gamma
        self.reduction = reduction
        self.label_smoothing = label_smoothing
        
        if alpha is not None:
            self.register_buffer('alpha', alpha)
        else:
            self.alpha = None
    
    def forward(self, inputs: torch.Tensor, targets: torch.Tensor) -> torch.Tensor:
        """
        Compute focal loss
        
        Args:
            inputs: Logits from model [batch_size, num_classes]
            targets: Ground truth labels [batch_size]
            
        Returns:
            Focal loss value
        """
        # Apply label smoothing if enabled
        if self.label_smoothing > 0.0:
            num_classes = inputs.size(1)
            smooth_targets = torch.zeros_like(inputs)
            smooth_targets.fill_(self.label_smoothing / (num_classes - 1))
            smooth_targets.scatter_(1, targets.unsqueeze(1), 1.0 - self.label_smoothing)
            targets_one_hot = smooth_targets
        else:
            # Convert targets to one-hot encoding
            num_classes = inputs.size(1)
            targets_one_hot = torch.zeros_like(inputs)
            targets_one_hot.scatter_(1, targets.unsqueeze(1), 1.0)
        
        # Compute cross entropy
        ce_loss = F.cross_entropy(inputs, targets, reduction='none')
        
        # Compute probabilities
        p = torch.softmax(inputs, dim=1)
        
        # Get probability of true class
        p_t = torch.sum(p * targets_one_hot, dim=1)
        
        # Compute focal weight: (1 - p_t)^gamma
        focal_weight = (1 - p_t) ** self.gamma
        
        # Apply alpha weighting if provided
        if self.alpha is not None:
            alpha_t = self.alpha[targets]
            focal_loss = alpha_t * focal_weight * ce_loss
        else:
            focal_loss = focal_weight * ce_loss
        
        # Apply reduction
        if self.reduction == 'mean':
            return focal_loss.mean()
        elif self.reduction == 'sum':
            return focal_loss.sum()
        else:
            return focal_loss


class LabelSmoothingCrossEntropy(nn.Module):
    """
    Cross Entropy Loss with Label Smoothing
    
    Label smoothing helps prevent overfitting by making the model less confident
    about its predictions.
    """
    
    def __init__(self, smoothing: float = 0.1, reduction: str = 'mean'):
        """
        Initialize Label Smoothing Cross Entropy
        
        Args:
            smoothing: Smoothing factor (0.0 = no smoothing, 0.1 = typical value)
            reduction: Reduction method ('mean', 'sum', or 'none')
        """
        super().__init__()
        self.smoothing = smoothing
        self.reduction = reduction
    
    def forward(self, inputs: torch.Tensor, targets: torch.Tensor) -> torch.Tensor:
        """
        Compute label smoothing cross entropy loss
        
        Args:
            inputs: Logits from model [batch_size, num_classes]
            targets: Ground truth labels [batch_size]
            
        Returns:
            Label smoothing loss value
        """
        log_probs = F.log_softmax(inputs, dim=1)
        num_classes = inputs.size(1)
        
        # Create smoothed targets
        with torch.no_grad():
            true_dist = torch.zeros_like(log_probs)
            true_dist.fill_(self.smoothing / (num_classes - 1))
            true_dist.scatter_(1, targets.unsqueeze(1), 1.0 - self.smoothing)
        
        # Compute KL divergence (equivalent to cross entropy with smoothed targets)
        loss = torch.sum(-true_dist * log_probs, dim=1)
        
        # Apply reduction
        if self.reduction == 'mean':
            return loss.mean()
        elif self.reduction == 'sum':
            return loss.sum()
        else:
            return loss
