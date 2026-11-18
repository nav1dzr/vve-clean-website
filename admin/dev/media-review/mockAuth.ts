export function useAuth() {
  return {
    status: 'authenticated',
    session: null,
    admin: { id: '00000000-0000-4000-8000-000000000001', displayName: 'Sample Owner', email: 'owner@example.test' },
    signOut: async () => {},
    retry: () => {},
  };
}
