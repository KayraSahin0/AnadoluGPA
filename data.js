// 1. Google Sheets Ayarları
const SPREADSHEET_ID = "1yRLA2ETYW4GxGgdDFKowNo0dtLHiInzmtcdD2fPahEE"; // Kendi ID'niz ile değiştirin

// 2. Bölüm Listesi (Dropdown'da görünecek adlar)
export const departmentsInfo = {
    "206": "İktisat",
    "207": "İşletme",
    "208": "Kamu Yönetimi",
    "209": "Maliye"
};

// 3. Not Baremi
export const gradeScale = {
    "AA": 4.00, "AB": 3.70, "BA": 3.30, "BB": 3.00, 
    "BC": 2.70, "CB": 2.30, "CC": 2.00, "CD": 1.70, 
    "DC": 1.30, "DD": 1.00, "FF": 0.00, "": 0
};

// 4. Veri Çekme Fonksiyonu
export async function fetchDepartmentData(deptCode) {
    // elk.sh servisi Google Sheets'i JSON'a çevirir
    const url = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/gviz/tq?tqx=out:csv&sheet=${deptCode}`;

    // Konsola linki basalım ki tıklayıp kontrol edebilin
    console.log("Veri İsteği:", url);
    
    try {
        const response = await fetch(url);
        // Eğer sunucu hata verirse (404 Bulunamadı vb.)
        if (!response.ok) {
            throw new Error(`Google Sheets'e ulaşılamadı. İzinleri kontrol edin.`);
        }
        
        const csvText = await response.text();
        
        // Gelen metni (CSV) JSON formatına çevir
        const data = csvToJson(csvText);

        return processSheetData(data);
    } catch (error) {
        console.error("Hata Detayı:", error);
        alert("Veri yüklenemedi! Sayfa adının (Örn: 206) doğru olduğundan emin olun.");
        return null;
    }
}

// YARDIMCI: CSV Metnini JSON Dizisine Çevirir
function csvToJson(csvText) {
    const lines = csvText.split('\n');
    const result = [];
    
    // İlk satır başlıklardır (Donem, DersKodu vs.)
    // Başlıkları temizle (Tırnak işaretlerini kaldır)
    const headers = parseCsvLine(lines[0]);

    for (let i = 1; i < lines.length; i++) {
        if (!lines[i].trim()) continue; // Boş satırları atla
        
        const currentLine = parseCsvLine(lines[i]);
        const obj = {};

        headers.forEach((header, index) => {
            // Başlıktaki boşlukları temizle ve eşleştir
            obj[header.trim()] = currentLine[index]; 
        });

        result.push(obj);
    }
    return result;
}

// YARDIMCI: Virgülle ayrılmış satırı, tırnak içindeki virgüllere dikkat ederek böler
function parseCsvLine(text) {
    // Google CSV'leri değerleri tırnak içine alır ("Değer"). Tırnakları temizleyelim.
    // Basitçe virgülle ayırıp tırnakları siliyoruz (Verinizde virgül içeren ders adı olmadığını varsayıyoruz)
    return text.split(',').map(val => val.replace(/^"|"$/g, '').trim());
}

// 5. Veriyi İşleme (Algoritma)
function processSheetData(rawData) {
    const semesters = {};
    const electivePool = [];

    // 1-8 Dönemleri Hazırla
    for (let i = 1; i <= 8; i++) {
        semesters[i] = [];
    }

    rawData.forEach(row => {
        // CSV'den gelen veriler her zaman String'dir. Sayıya çevirmeliyiz.
        const donemRaw = row.Donem; 
        const kredi = parseInt(row.Kredi) || 0;
        const tur = row.Tur; 

        const courseObj = {
            code: row.DersKodu,
            name: row.DersAdi,
            credit: kredi,
            type: tur, 
            originalSemester: donemRaw
        };

        // Donem sayı değilse havuza at
        if (isNaN(donemRaw) || donemRaw === "" || donemRaw === undefined) {
            electivePool.push(courseObj);
        } else {
            if (semesters[donemRaw]) {
                semesters[donemRaw].push(courseObj);
            }
        }
    });

    return { semesters, electivePool };
}