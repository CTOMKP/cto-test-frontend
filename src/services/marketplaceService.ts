import axios from 'axios';
import { getBackendUrl } from '../utils/apiConfig';

export const marketplaceService = {
  async getPricing() {
    const backendUrl = getBackendUrl();
    const res = await axios.get(`${backendUrl}/api/v1/marketplace/pricing`);
    return res.data?.items || res.data?.data || res.data || [];
  },
};

export default marketplaceService;
