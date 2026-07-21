// Utility function to get high quality Google avatar URL
export const getHighQualityGooglePhotoUrl = (photoURL: string | null): string => {
  if (!photoURL) return '';
  
  // Check if it's a Google photo URL
  if (photoURL.includes('googleusercontent.com')) {
    // Remove size parameter and request a larger image
    return photoURL.replace(/=s\d+-c/, '=s400-c');
  }
  
  return photoURL;
};