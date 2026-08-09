declare module "heic-convert" {
  type ConversionOptions = {
    buffer: Buffer | Uint8Array;
    format: "JPEG" | "PNG";
    quality?: number;
  };

  export default function convert(options: ConversionOptions): Promise<Buffer>;
}
