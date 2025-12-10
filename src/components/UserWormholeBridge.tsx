import React from 'react';
import { useAuth } from '../hooks/useAuth';
import WormholeBridge from './WormholeBridge';

const UserWormholeBridge: React.FC = () => {
  const { user } = useAuth();
  
  return <WormholeBridge userId={user?.email} />;
};

export default UserWormholeBridge;

