// Özkon Takip - Merkezi Para, Sayı ve Tarih Formatlama Yardımcıları

/**
 * Sayıyı Türk Lirası para formatında (2 ondalık basamaklı, örn: "1.250,50 ₺") döndürür.
 */
export const formatCurrency = (amount: number | null | undefined): string => {
  const val = typeof amount === "number" && !isNaN(amount) ? amount : 0;
  return `${val.toLocaleString("tr-TR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })} ₺`;
};

/**
 * Sayıyı belirtilen ondalık basamakla Türkçe formatında biçimlendirir.
 */
export const formatNumber = (num: number | null | undefined, decimals = 2): string => {
  const val = typeof num === "number" && !isNaN(num) ? num : 0;
  return val.toLocaleString("tr-TR", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  });
};

/**
 * Tarihi Türkçe formatında (GG.AA.YYYY) döndürür.
 */
export const formatDate = (date: string | Date | null | undefined): string => {
  if (!date) return "-";
  try {
    const d = typeof date === "string" ? new Date(date) : date;
    if (isNaN(d.getTime())) return "-";
    return d.toLocaleDateString("tr-TR");
  } catch {
    return "-";
  }
};

/**
 * Tarih ve saati Türkçe formatında (GG.AA.YYYY SS:DD) döndürür.
 */
export const formatDateTime = (date: string | Date | null | undefined): string => {
  if (!date) return "-";
  try {
    const d = typeof date === "string" ? new Date(date) : date;
    if (isNaN(d.getTime())) return "-";
    return `${d.toLocaleDateString("tr-TR")} ${d.toLocaleTimeString("tr-TR", {
      hour: "2-digit",
      minute: "2-digit"
    })}`;
  } catch {
    return "-";
  }
};
