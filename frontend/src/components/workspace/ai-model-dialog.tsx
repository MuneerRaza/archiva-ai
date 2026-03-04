"use client";

import { useEffect, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Loader2,
  Wifi,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useCreateAIModel, useUpdateAIModel, useTestAIModel } from "@/lib/queries/ai-models";
import type { AIModel, AIModelType, LLMProvider } from "@/types/models";

const PROVIDERS: { value: LLMProvider; label: string }[] = [
  { value: "ollama", label: "Ollama" },
  { value: "vllm", label: "vLLM" },
  { value: "openai", label: "OpenAI" },
  { value: "anthropic", label: "Anthropic" },
  { value: "gemini", label: "Gemini" },
  { value: "groq", label: "Groq" },
];

const MODEL_TYPES: { value: AIModelType; label: string }[] = [
  { value: "llm", label: "LLM" },
  { value: "transcription", label: "Transcription" },
];

const DEFAULT_BASE_URLS: Record<string, string> = {
  ollama: "http://localhost:11434",
  vllm: "http://localhost:8001",
};

const NEEDS_BASE_URL = new Set(["ollama", "vllm"]);
const NEEDS_API_KEY = new Set(["openai", "anthropic", "gemini", "groq"]);

interface AIModelDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editModel?: AIModel;
}

export function AIModelDialog({ open, onOpenChange, editModel }: AIModelDialogProps) {
  const isEditing = !!editModel;
  const createModel = useCreateAIModel();
  const updateModel = useUpdateAIModel();
  const testModel = useTestAIModel();

  const [label, setLabel] = useState("");
  const [modelType, setModelType] = useState<AIModelType>("llm");
  const [provider, setProvider] = useState<LLMProvider>("ollama");
  const [model, setModel] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [contextLength, setContextLength] = useState<string>("");
  const [capabilities, setCapabilities] = useState<string[]>([]);
  const [testStatus, setTestStatus] = useState<"idle" | "testing" | "success" | "failed">("idle");
  const [testError, setTestError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      if (editModel) {
        setLabel(editModel.label);
        setModelType(editModel.model_type);
        setProvider(editModel.provider);
        setModel(editModel.model);
        setBaseUrl(editModel.base_url);
        setApiKey("");
        setContextLength(editModel.context_length ? String(editModel.context_length) : "");
        setCapabilities(editModel.capabilities);
      } else {
        setLabel("");
        setModelType("llm");
        setProvider("ollama");
        setModel("");
        setBaseUrl(DEFAULT_BASE_URLS["ollama"] ?? "");
        setApiKey("");
        setContextLength("");
        setCapabilities([]);
      }
      setTestStatus("idle");
      setTestError(null);
    }
  }, [open, editModel]);

  function handleProviderChange(v: string) {
    const p = v as LLMProvider;
    setProvider(p);
    setBaseUrl(DEFAULT_BASE_URLS[p] ?? "");
    setApiKey("");
    setTestStatus("idle");
    setTestError(null);
  }

  async function handleTest() {
    setTestStatus("testing");
    setTestError(null);
    testModel.mutate(
      {
        model_type: modelType,
        provider,
        model,
        base_url: baseUrl || DEFAULT_BASE_URLS[provider] || "",
        api_key: apiKey || undefined,
      },
      {
        onSuccess: (res) => {
          if (res.data.success) {
            setTestStatus("success");
            if (res.data.capabilities.length > 0) {
              setCapabilities(res.data.capabilities);
            }
          } else {
            setTestStatus("failed");
            setTestError(res.data.error);
          }
        },
        onError: () => {
          setTestStatus("failed");
          setTestError("Failed to reach the server");
        },
      },
    );
  }

  function handleSave() {
    const parsedCtx = contextLength ? parseInt(contextLength, 10) : null;
    const ctxValue = parsedCtx && !isNaN(parsedCtx) && parsedCtx > 0 ? parsedCtx : null;

    if (isEditing) {
      updateModel.mutate(
        {
          id: editModel.id,
          label,
          model_type: modelType,
          provider,
          model,
          base_url: baseUrl,
          ...(apiKey ? { api_key: apiKey } : {}),
          capabilities,
          context_length: ctxValue,
        },
        { onSuccess: () => onOpenChange(false) },
      );
    } else {
      createModel.mutate(
        {
          label,
          model_type: modelType,
          provider,
          model,
          base_url: baseUrl,
          api_key: apiKey || undefined,
          capabilities,
          context_length: ctxValue,
        },
        { onSuccess: () => onOpenChange(false) },
      );
    }
  }

  const showBaseUrl = NEEDS_BASE_URL.has(provider);
  const showApiKey = NEEDS_API_KEY.has(provider);
  const canSave = label.trim() && model.trim();
  const saving = createModel.isPending || updateModel.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit Model" : "Add Model"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>Label</Label>
            <Input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g. Ollama Qwen 14B"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Type</Label>
              <Select value={modelType} onValueChange={(v) => setModelType(v as AIModelType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MODEL_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Provider</Label>
              <Select value={provider} onValueChange={handleProviderChange}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PROVIDERS.map((p) => (
                    <SelectItem key={p.value} value={p.value}>
                      {p.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Model</Label>
            <Input
              value={model}
              onChange={(e) => { setModel(e.target.value); setTestStatus("idle"); }}
              placeholder={showApiKey ? "e.g. gpt-4o, claude-sonnet-4-5" : "e.g. qwen2.5:14b"}
            />
          </div>

          {showBaseUrl && (
            <div className="space-y-2">
              <Label>Base URL</Label>
              <Input
                value={baseUrl}
                onChange={(e) => { setBaseUrl(e.target.value); setTestStatus("idle"); }}
                placeholder={DEFAULT_BASE_URLS[provider] ?? ""}
              />
            </div>
          )}

          {showApiKey && (
            <div className="space-y-2">
              <Label>API Key</Label>
              <Input
                type="password"
                value={apiKey}
                onChange={(e) => { setApiKey(e.target.value); setTestStatus("idle"); }}
                placeholder={isEditing && editModel.has_api_key ? "Leave blank to keep current" : "sk-..."}
              />
            </div>
          )}

          {modelType === "llm" && (
            <div className="space-y-2">
              <Label>Context Length (tokens)</Label>
              <Input
                type="number"
                value={contextLength}
                onChange={(e) => setContextLength(e.target.value)}
                placeholder="e.g. 8192, 32768, 131072"
              />
              <p className="text-[11px] text-muted-foreground">
                Max tokens the model can handle. Used to optimize how much document content the agent reads per call.
              </p>
            </div>
          )}

          {/* Test + capabilities */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {capabilities.length > 0 && capabilities.map((cap) => (
                <Badge key={cap} variant="secondary" className="text-[11px]">
                  {cap}
                </Badge>
              ))}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleTest}
              disabled={!model.trim() || testStatus === "testing"}
            >
              {testStatus === "testing" ? (
                <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
              ) : testStatus === "success" ? (
                <CheckCircle2 className="mr-2 h-3.5 w-3.5 text-green-500" />
              ) : testStatus === "failed" ? (
                <AlertCircle className="mr-2 h-3.5 w-3.5 text-destructive" />
              ) : (
                <Wifi className="mr-2 h-3.5 w-3.5" />
              )}
              Test Connection
            </Button>
          </div>

          {testStatus === "failed" && testError && (
            <div className="flex items-start gap-2 rounded-md bg-destructive/10 px-3 py-2">
              <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-destructive" />
              <p className="text-[12px] text-destructive">{testError}</p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!canSave || saving}>
            {saving && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
            {isEditing ? "Save" : "Add Model"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
