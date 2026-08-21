import "./styles.css";

export const metadata = {
  title: "Social Video Scheduler",
  description: "TikTok, YouTube and Facebook social video scheduler",
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
