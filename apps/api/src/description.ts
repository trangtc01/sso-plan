const DEFAULT_FOOTER = `Website: https://play.kidenglish.io.vn/
Android: https://play.google.com/store/apps/details?id=kiddy.learn.app
IOS: Coming soon`;

export function normalizeDescription(description = ""): string {
  const trimmed = description.trim();
  const footerMarker = "Website: https://play.kidenglish.io.vn/";
  if (trimmed.includes(footerMarker)) {
    return trimmed;
  }
  return trimmed ? `${trimmed}\n\n${DEFAULT_FOOTER}` : DEFAULT_FOOTER;
}
