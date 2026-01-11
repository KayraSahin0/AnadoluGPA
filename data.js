// data.js - FİNAL VERSİYON

// 1. Google Sheets Ayarları
const SPREADSHEET_ID = "1yRLA2ETYW4GxGgdDFKowNo0dtLHiInzmtcdD2fPahEE"; 

// Not Baremi (Sabit)
export const gradeScale = {
    "AA": 4.00, "AB": 3.70, "BA": 3.30, "BB": 3.00, 
    "BC": 2.70, "CB": 2.30, "CC": 2.00, "CD": 1.70, 
    "DC": 1.30, "DD": 1.00, "FF": 0.00, "": 0
};

// 2. Veri Çekme Fonksiyonu
export async function fetchDepartmentData(deptCode) {
    // Cache (önbellek) sorununu önlemek için URL'in sonuna rastgele zaman damgası ekliyoruz
    const url = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/gviz/tq?tqx=out:csv&sheet=${deptCode}&t=${Date.now()}`;
    
    try {
        const response = await fetch(url);
        
        // Eğer 400/404 gibi bir hata dönerse
        if (!response.ok) {
            throw new Error("Google Sheets'e ulaşılamadı.");
        }
        
        const csvText = await response.text();
        
        // Gelen metni işlemesi için yardımcı fonksiyona gönderiyoruz
        return processCSV(csvText, deptCode);

    } catch (error) {
        console.error(error);
        alert(`HATA: "${deptCode}" kodlu sayfa verisi çekilemedi.\n\nLütfen Google Sheets dosyanızda, sayfanın (sekme) adının tam olarak "${deptCode}" olduğundan emin olun.`);
        return null;
    }
}

// 3. CSV İşleme Motoru
function processCSV(csvText, deptCode) {
    const lines = csvText.split('\n');
    
    // Eğer dosya boşsa veya sadece başlık varsa işlem yapma
    if (lines.length < 2) return null;

    // Başlıkları al ve temizle
    const headers = parseLine(lines[0]);
    
    // BAŞLIK KONTROLÜ (En sık yapılan hatayı yakalamak için)
    const required = ["Donem", "DersKodu", "DersAdi", "Tur", "Kredi"];
    const missing = required.filter(r => !headers.includes(r));
    
    if (missing.length > 0) {
        alert(`KRİTİK HATA: "${deptCode}" adlı sayfada şu sütun başlıkları EKSİK veya YANLIŞ YAZILMIŞ:\n\n${missing.join(", ")}\n\nLütfen Excel'de 1. satırın tam olarak şu sırayla olduğundan emin olun:\nDonem, DersKodu, DersAdi, Tur, Kredi`);
        return null;
    }

    const semesters = {};
    const electivePools = {};
    
    // 1'den 8'e kadar dönem kutularını hazırla
    for (let i = 1; i <= 8; i++) semesters[i] = [];

    // Satırları tek tek dön (Başlığı atla, index 1'den başla)
    for (let i = 1; i < lines.length; i++) {
        // Boş satırları atla
        if (!lines[i].trim()) continue;
        
        const rowData = parseLine(lines[i]);
        const row = {};
        
        // Veriyi başlıklarla eşleştir (row.Donem, row.DersAdi gibi)
        headers.forEach((h, idx) => row[h] = rowData[idx] || "");

        // Veri Temizliği
        const donem = row.Donem;
        const kredi = parseInt(row.Kredi) || 0;
        // Tür bilgisindeki boşlukları temizle ("Mesleki Seçmeli " -> "Mesleki Seçmeli")
        const tur = row.Tur ? row.Tur.trim() : "Zorunlu";
        
        const course = { 
            code: row.DersKodu, 
            name: row.DersAdi, 
            credit: kredi, 
            type: tur 
        };

        // AYRIŞTIRMA MANTIĞI:
        // Dönem sütununda sayı yoksa (boş veya yazı ise) -> HAVUZ
        if (isNaN(donem) || donem === "") {
            // Eğer bu türde bir havuz henüz yoksa oluştur
            if (!electivePools[tur]) electivePools[tur] = [];
            
            electivePools[tur].push(course);
        } else {
            // Dönem sütununda sayı varsa -> NORMAL DERS
            if (semesters[donem]) {
                semesters[donem].push(course);
            }
        }
    }

    return { semesters, electivePools };
}

// YARDIMCI: Güvenli CSV Ayırıcı
// (Excel bazen verileri tırnak içine alır: "Ders, Adı". Bunu düzgün böler.)
function parseLine(text) {
    const result = [];
    let cur = '', inQuote = false;
    
    for (let c of text) {
        if (c === '"') {
            inQuote = !inQuote; // Tırnak aç/kapat
        } else if (c === ',' && !inQuote) {
            result.push(cur.trim()); // Virgül gördüysen böl
            cur = '';
        } else {
            cur += c; // Karaktere devam et
        }
    }
    result.push(cur.trim());
    
    // Başta ve sondaki tırnak işaretlerini temizle
    return result.map(x => x.replace(/^"|"$/g, ''));
}