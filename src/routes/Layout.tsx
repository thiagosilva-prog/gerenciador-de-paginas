import { Outlet } from 'react-router';

export default function Layout() {
  return (
    <div className="min-h-screen w-full bg-(--content-bg)">
      <div className="max-w-[1400px] mx-auto w-full p-4 md:p-6 lg:p-8">
        <Outlet />
      </div>
    </div>
  );
}
