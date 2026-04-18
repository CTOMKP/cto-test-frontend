import axios from 'axios';

export interface SupportTicketPayload {
  subject: string;
  message: string;
  category?: 'GENERAL' | 'SWAP' | 'WALLET' | 'PAYMENT' | 'LISTING' | 'ADS' | 'ACCOUNT' | 'OTHER';
  priority?: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
}

export interface SupportTicket {
  id: string;
  subject: string;
  message: string;
  category: string;
  priority: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

const backendUrl = process.env.REACT_APP_BACKEND_URL || 'https://api.ctomarketplace.com';

const unwrap = <T = any>(payload: any): T => {
  let current = payload;
  for (let i = 0; i < 5; i += 1) {
    if (!current || typeof current !== 'object') break;
    if (current.data !== undefined) {
      current = current.data;
      continue;
    }
    break;
  }
  return current as T;
};

const supportTicketService = {
  async submit(payload: SupportTicketPayload): Promise<SupportTicket> {
    const token = localStorage.getItem('cto_auth_token');
    const res = await axios.post(
      `${backendUrl}/api/v1/support/tickets`,
      payload,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      }
    );
    return unwrap<SupportTicket>(res.data);
  },

  async getMine(limit = 10): Promise<SupportTicket[]> {
    const token = localStorage.getItem('cto_auth_token');
    const res = await axios.get(
      `${backendUrl}/api/v1/support/tickets/mine?limit=${limit}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );
    return unwrap<SupportTicket[]>(res.data) || [];
  },
};

export default supportTicketService;

