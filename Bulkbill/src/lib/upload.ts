
// src/lib/upload.ts

export async function uploadPdfFile(file: File): Promise<string> {
  const formData = new FormData();
  formData.append('pdf', file);

  const response = await fetch('/api/upload/pdf', {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || 'Failed to upload PDF file');
  }

  const data = await response.json();
  return data.pdfUrl; // Assuming the API returns { pdfUrl: "..." }
}
