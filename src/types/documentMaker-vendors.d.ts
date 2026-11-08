declare module "mammoth/mammoth.browser" {
  export function convertToHtml(input: {
    arrayBuffer: ArrayBuffer;
    convertImage?: (image: {
      contentType: string;
      read(encoding: "base64"): Promise<string>;
    }) => Promise<{ src: string }>;
  }): Promise<{ value: string; messages: Array<{ type: string; message: string }> }>;
  export const images: {
    imgElement(
      convert: (image: {
        contentType: string;
        read(encoding: "base64"): Promise<string>;
      }) => Promise<{ src: string }>,
    ): (image: {
      contentType: string;
      read(encoding: "base64"): Promise<string>;
    }) => Promise<{ src: string }>;
  };
}

declare module "pdfmake/build/pdfmake" {
  interface PdfMakeInstance {
    createPdf(
      definition: unknown,
      tableLayouts?: unknown,
      fonts?: Record<string, unknown>,
      virtualFileSystem?: Record<string, string>,
    ): {
      getBlob(callback: (blob: Blob) => void): void;
    };
  }
  const pdfMake: PdfMakeInstance;
  export default pdfMake;
}

declare module "pdfmake/build/vfs_fonts" {
  const fonts: Record<string, string>;
  export default fonts;
}
