import "./styles.css";

export const metadata = {
  title: "Social Video Scheduler",
  description: "TikTok, YouTube and Facebook social video scheduler",
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function Layout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="vi">
      <body>
        <main>{children}</main>
      </body>
    </html>
  );
}
