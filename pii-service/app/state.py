"""Shared detector singletons (one model load per process)."""

from app.detectors.image import ImageDetector
from app.detectors.text import TextDetector
from app.detectors.video import VideoDetector
from app.detectors.vision import VisionDetector

text_detector = TextDetector()
vision_detector = VisionDetector()
image_detector = ImageDetector(vision_detector, text_detector)
video_detector = VideoDetector(vision_detector)
