import axios from 'axios';
import { getBackendUrl } from '../utils/apiConfig';

const backendUrl = getBackendUrl();

function authHeaders() {
  const token = localStorage.getItem('cto_auth_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export const paymentService = {
  async verify(paymentId: string, txHash: string) {
    const res = await axios.post(
      `${backendUrl}/api/v1/payment/movement/verify/${paymentId}`,
      { txHash },
      { headers: authHeaders() }
    );
    return res.data?.data || res.data;
  },
};

export default paymentService;
