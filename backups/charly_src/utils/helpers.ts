export const formatAddress = (address: string, start: number = 6, end: number = 4): string => {
  if (!address || address.length < start + end) return address;
  return `${address.slice(0, start)}...${address.slice(-end)}`;
};

export const formatBalance = (amount: string, decimals: number): string => {
  const num = parseFloat(amount) / Math.pow(10, decimals);
  return num.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 6,
  });
};


export const validateAptosAddress = (address: string): boolean => {
  // Aptos addresses are 64 characters long and contain only hex characters
  const aptosAddressRegex = /^[0-9a-fA-F]{64}$/;
  return aptosAddressRegex.test(address);
};

export const copyToClipboard = async (text: string): Promise<boolean> => {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (error) {
    // Fallback for older browsers
    const textArea = document.createElement('textarea');
    textArea.value = text;
    document.body.appendChild(textArea);
    textArea.select();
    try {
      document.execCommand('copy');
      document.body.removeChild(textArea);
      return true;
    } catch (fallbackError) {
      document.body.removeChild(textArea);
      return false;
    }
  }
};



export const handleApiError = (error: any): string => {
  if (error.response?.data?.message) {
    return error.response.data.message;
  }
  
  if (error.message) {
    return error.message;
  }
  
  return 'An unexpected error occurred. Please try again.';
};



