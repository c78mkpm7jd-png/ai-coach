declare module "pdf-parse-fork" {
  function pdfParse(buffer: Buffer): Promise<{ text: string }>;
  export default pdfParse;
}
