// Fixed catalogs of selectable PII entity types (Presidio/GLiNER) and YOLO
// visual classes (COCO). Users pick from these — no free-text entry, so a run
// can never request a class the detectors don't understand.

export interface CatalogOption {
  value: string;
  label: string;
}

/** Text/transcript entity types supported by Presidio + GLiNER. */
export const TEXT_ENTITY_OPTIONS: CatalogOption[] = [
  { value: "PERSON", label: "Person" },
  { value: "EMAIL_ADDRESS", label: "Email address" },
  { value: "PHONE_NUMBER", label: "Phone number" },
  { value: "CREDIT_CARD", label: "Credit card" },
  { value: "US_SSN", label: "US SSN" },
  { value: "IBAN_CODE", label: "IBAN / bank code" },
  { value: "US_BANK_NUMBER", label: "Bank account number" },
  { value: "IP_ADDRESS", label: "IP address" },
  { value: "LOCATION", label: "Location / address" },
  { value: "ORGANIZATION", label: "Organization" },
  { value: "DATE_TIME", label: "Date / time" },
  { value: "URL", label: "URL" },
  { value: "US_DRIVER_LICENSE", label: "US driver license" },
  { value: "US_PASSPORT", label: "US passport" },
  { value: "MEDICAL_LICENSE", label: "Medical license" },
  { value: "CRYPTO", label: "Crypto wallet" },
  { value: "NRP", label: "Nationality / religion / group" },
];

// COCO classes the stock YOLO model can detect. `person` is the PII-relevant
// default; the rest are available and a future custom PII model adds faces /
// plates / IDs without any UI change.
const COCO_CLASSES = [
  "person", "bicycle", "car", "motorcycle", "airplane", "bus", "train", "truck",
  "boat", "traffic light", "fire hydrant", "stop sign", "parking meter", "bench",
  "bird", "cat", "dog", "horse", "sheep", "cow", "elephant", "bear", "zebra",
  "giraffe", "backpack", "umbrella", "handbag", "tie", "suitcase", "frisbee",
  "skis", "snowboard", "sports ball", "kite", "baseball bat", "baseball glove",
  "skateboard", "surfboard", "tennis racket", "bottle", "wine glass", "cup",
  "fork", "knife", "spoon", "bowl", "banana", "apple", "sandwich", "orange",
  "broccoli", "carrot", "hot dog", "pizza", "donut", "cake", "chair", "couch",
  "potted plant", "bed", "dining table", "toilet", "tv", "laptop", "mouse",
  "remote", "keyboard", "cell phone", "microwave", "oven", "toaster", "sink",
  "refrigerator", "book", "clock", "vase", "scissors", "teddy bear",
  "hair drier", "toothbrush",
];

export const YOLO_CLASS_OPTIONS: CatalogOption[] = COCO_CLASSES.map((c) => ({
  value: c,
  label: c.charAt(0).toUpperCase() + c.slice(1),
}));
