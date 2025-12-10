import React, { useState, useEffect } from 'react';
import { adminService, DashboardStats } from '../../services/adminService';
import toast from 'react-hot-toast';

export const AdminDashboard: React.FC = () => {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [pendingListings, setPendingListings] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [activeBoosts, setActiveBoosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'stats' | 'listings' | 'payments' | 'boosts'>('stats');

  const adminUserId = localStorage.getItem('cto_user_email') || '';

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [statsData, listingsData, paymentsData, boostsData] = await Promise.all([
        adminService.getDashboardStats(),
        adminService.getPendingListings(),
        adminService.getAllPayments(),
        adminService.getActiveAdBoosts(),
      ]);

      setStats(statsData.stats);
      setPendingListings(listingsData.listings || []);
      setPayments(paymentsData.payments || []);
      setActiveBoosts(boostsData.boosts || []);
    } catch (error: any) {
      console.error('Failed to load admin data:', error);
      toast.error('Failed to load admin data');
    } finally {
      setLoading(false);
    }
  };

  const handleApproveListing = async (listingId: string) => {
    try {
      await adminService.approveListing(listingId, adminUserId);
      toast.success('Listing approved!');
      loadData();
    } catch (error: any) {
      console.error('Failed to approve listing:', error);
      toast.error('Failed to approve listing');
    }
  };

  const handleRejectListing = async (listingId: string) => {
    const reason = prompt('Reason for rejection:');
    if (!reason) return;

    try {
      await adminService.rejectListing(listingId, adminUserId, reason);
      toast.success('Listing rejected');
      loadData();
    } catch (error: any) {
      console.error('Failed to reject listing:', error);
      toast.error('Failed to reject listing');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-800 mb-6">🛡️ Admin Dashboard</h1>

        {/* Tabs */}
        <div className="bg-white rounded-lg shadow-md mb-6">
          <div className="flex border-b">
            <button
              onClick={() => setActiveTab('stats')}
              className={`px-6 py-3 font-semibold ${
                activeTab === 'stats'
                  ? 'border-b-2 border-blue-600 text-blue-600'
                  : 'text-gray-600 hover:text-blue-600'
              }`}
            >
              📊 Statistics
            </button>
            <button
              onClick={() => setActiveTab('listings')}
              className={`px-6 py-3 font-semibold ${
                activeTab === 'listings'
                  ? 'border-b-2 border-blue-600 text-blue-600'
                  : 'text-gray-600 hover:text-blue-600'
              }`}
            >
              📝 Pending Listings ({pendingListings.length})
            </button>
            <button
              onClick={() => setActiveTab('payments')}
              className={`px-6 py-3 font-semibold ${
                activeTab === 'payments'
                  ? 'border-b-2 border-blue-600 text-blue-600'
                  : 'text-gray-600 hover:text-blue-600'
              }`}
            >
              💰 Payments ({payments.length})
            </button>
            <button
              onClick={() => setActiveTab('boosts')}
              className={`px-6 py-3 font-semibold ${
                activeTab === 'boosts'
                  ? 'border-b-2 border-blue-600 text-blue-600'
                  : 'text-gray-600 hover:text-blue-600'
              }`}
            >
              🚀 Ad Boosts ({activeBoosts.length})
            </button>
          </div>
        </div>

        {/* Statistics Tab */}
        {activeTab === 'stats' && stats && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
            <div className="bg-white rounded-lg shadow-md p-6">
              <h3 className="text-gray-600 text-sm font-semibold mb-2">Total Users</h3>
              <p className="text-3xl font-bold text-blue-600">{stats.users.total}</p>
            </div>

            <div className="bg-white rounded-lg shadow-md p-6">
              <h3 className="text-gray-600 text-sm font-semibold mb-2">Listings</h3>
              <p className="text-3xl font-bold text-green-600">{stats.listings.total}</p>
              <p className="text-sm text-gray-500 mt-2">
                {stats.listings.pending} pending, {stats.listings.published} published
              </p>
            </div>

            <div className="bg-white rounded-lg shadow-md p-6">
              <h3 className="text-gray-600 text-sm font-semibold mb-2">Revenue</h3>
              <p className="text-3xl font-bold text-purple-600">
                ${stats.payments.revenue.toFixed(2)}
              </p>
              <p className="text-sm text-gray-500 mt-2">{stats.payments.currency}</p>
            </div>

            <div className="bg-white rounded-lg shadow-md p-6">
              <h3 className="text-gray-600 text-sm font-semibold mb-2">Active Boosts</h3>
              <p className="text-3xl font-bold text-orange-600">{stats.adBoosts.active}</p>
            </div>
          </div>
        )}

        {/* Pending Listings Tab */}
        {activeTab === 'listings' && (
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-bold text-gray-800 mb-4">Pending Listings</h2>
            {pendingListings.length === 0 ? (
              <p className="text-gray-500">No pending listings</p>
            ) : (
              <div className="space-y-4">
                {pendingListings.map((listing) => (
                  <div key={listing.id} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="font-bold text-lg text-gray-800">{listing.title}</h3>
                        <p className="text-sm text-gray-600">{listing.contractAddr}</p>
                        <p className="text-xs text-gray-500 mt-1">
                          Tier: <span className="font-semibold">{listing.vettingTier}</span> | 
                          Score: <span className="font-semibold">{listing.vettingScore}</span>
                        </p>
                        <p className="text-xs text-gray-500">
                          Submitted by: {listing.user?.email}
                        </p>
                      </div>
                      <div className="flex space-x-2">
                        <button
                          onClick={() => handleApproveListing(listing.id)}
                          className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700"
                        >
                          ✅ Approve
                        </button>
                        <button
                          onClick={() => handleRejectListing(listing.id)}
                          className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700"
                        >
                          ❌ Reject
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Payments Tab */}
        {activeTab === 'payments' && (
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-bold text-gray-800 mb-4">Recent Payments</h2>
            {payments.length === 0 ? (
              <p className="text-gray-500">No payments yet</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 px-4 text-sm font-semibold text-gray-600">ID</th>
                      <th className="text-left py-2 px-4 text-sm font-semibold text-gray-600">Type</th>
                      <th className="text-left py-2 px-4 text-sm font-semibold text-gray-600">Amount</th>
                      <th className="text-left py-2 px-4 text-sm font-semibold text-gray-600">Status</th>
                      <th className="text-left py-2 px-4 text-sm font-semibold text-gray-600">Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {payments.slice(0, 20).map((payment) => (
                      <tr key={payment.id} className="border-b hover:bg-gray-50">
                        <td className="py-2 px-4 text-xs">{payment.id.substring(0, 8)}...</td>
                        <td className="py-2 px-4 text-sm">{payment.paymentType}</td>
                        <td className="py-2 px-4 text-sm font-semibold">
                          ${payment.amount} {payment.currency}
                        </td>
                        <td className="py-2 px-4">
                          <span
                            className={`text-xs px-2 py-1 rounded-full ${
                              payment.status === 'COMPLETED'
                                ? 'bg-green-100 text-green-800'
                                : payment.status === 'PENDING'
                                ? 'bg-yellow-100 text-yellow-800'
                                : 'bg-red-100 text-red-800'
                            }`}
                          >
                            {payment.status}
                          </span>
                        </td>
                        <td className="py-2 px-4 text-xs text-gray-500">
                          {new Date(payment.createdAt).toLocaleDateString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Ad Boosts Tab */}
        {activeTab === 'boosts' && (
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-bold text-gray-800 mb-4">Active Ad Boosts</h2>
            {activeBoosts.length === 0 ? (
              <p className="text-gray-500">No active ad boosts</p>
            ) : (
              <div className="space-y-4">
                {activeBoosts.map((boost) => (
                  <div key={boost.id} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="font-bold text-lg text-gray-800">
                          {boost.listing?.title || 'Unknown Listing'}
                        </h3>
                        <p className="text-sm text-gray-600">
                          Boost Type: <span className="font-semibold">{boost.type}</span>
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                          Duration: {boost.durationDays} days | 
                          Ends: {new Date(boost.endDate).toLocaleDateString()}
                        </p>
                      </div>
                      <span className="bg-green-100 text-green-800 text-xs px-3 py-1 rounded-full">
                        Active
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <button
          onClick={loadData}
          className="mt-6 bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700"
        >
          🔄 Refresh Data
        </button>
      </div>
    </div>
  );
};

export default AdminDashboard;

