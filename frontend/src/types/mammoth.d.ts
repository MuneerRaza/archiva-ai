declare module "mammoth" {
  interface ConvertResult {
    value: string;
    messages: Array<{ type: string; message: string }>;
  }

  interface ConvertOptions {
    arrayBuffer: ArrayBuffer;
  }

  function convertToHtml(options: ConvertOptions): Promise<ConvertResult>;
}

declare module "mammoth/mammoth.browser" {
  interface ConvertResult {
    value: string;
    messages: Array<{ type: string; message: string }>;
  }

  interface ConvertOptions {
    arrayBuffer: ArrayBuffer;
  }

  function convertToHtml(options: ConvertOptions): Promise<ConvertResult>;
}
