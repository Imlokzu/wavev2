export async function uploadToR2(file: File): Promise<string> {
  return new Promise((resolve) => {
    // Return a real local blob URL so it renders in the chat
    const objectUrl = URL.createObjectURL(file);
    setTimeout(() => {
      resolve(objectUrl);
    }, 1500);
  });
}
