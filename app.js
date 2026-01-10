// app.js
import { departmentsInfo, gradeScale, fetchDepartmentData } from './data.js';

const departmentSelect = document.getElementById('departmentSelect');
const semestersContainer = document.getElementById('semestersContainer');
const totalCreditsEl = document.getElementById('totalCredits');
const gpaResultEl = document.getElementById('gpaResult');
const loadingIndicator = document.getElementById('loadingIndicator'); // Yeni eklenen loading

// Global değişken (Seçmeli ders havuzunu tutmak için)
let currentElectivePool = [];

// Sayfa Yüklendiğinde
document.addEventListener('DOMContentLoaded', () => {
    loadDepartmentOptions();
    
    // İlk bölümü otomatik seç ve yükle
    const firstDeptCode = Object.keys(departmentsInfo)[0];
    if (firstDeptCode) {
        departmentSelect.value = firstDeptCode;
        loadSemesters(firstDeptCode);
    }
});

// Dropdown Menüyü Doldur
function loadDepartmentOptions() {
    departmentSelect.innerHTML = ""; // Temizle
    for (const [code, name] of Object.entries(departmentsInfo)) {
        const option = document.createElement('option');
        option.value = code;
        option.textContent = `${name} (${code})`;
        departmentSelect.appendChild(option);
    }
}

// Bölüm Değiştiğinde
departmentSelect.addEventListener('change', (e) => {
    loadSemesters(e.target.value);
});

// Veriyi Çek ve Ekrana Bas
async function loadSemesters(deptCode) {
    // 1. Loading göster, içeriği temizle
    loadingIndicator.style.display = 'block';
    semestersContainer.style.opacity = '0.5';
    
    // 2. Veriyi data.js'den iste
    const data = await fetchDepartmentData(deptCode);
    
    // 3. Loading gizle
    loadingIndicator.style.display = 'none';
    semestersContainer.style.opacity = '1';
    semestersContainer.innerHTML = ''; // Eski listeyi sil

    if (!data) return; // Hata olduysa dur

    // Global havuzu güncelle
    currentElectivePool = data.electivePool;

    // 4. Dönemleri Döngüye Sok
    for (const [semId, courses] of Object.entries(data.semesters)) {
        // Eğer o dönemde hiç ders yoksa kart oluşturma (isteğe bağlı)
        if (courses.length === 0) continue; 

        const card = createSemesterCard(semId, courses);
        semestersContainer.appendChild(card);
    }

    // 5. Hesaplama motorunu başlat
    attachEventListeners();
    calculateAll();
}

// HTML Kart Oluşturucu
function createSemesterCard(semId, courses) {
    const card = document.createElement('div');
    card.className = 'semester-card';

    // Kart Başlığı
    let htmlContent = `
        <div class="semester-header">
            <span>${semId}. Yarıyıl</span>
            <span class="semester-gpa">Ort: 0.00</span>
        </div>
        <div class="course-list">
    `;

    // Ders Satırları
    courses.forEach(course => {
        htmlContent += createCourseRow(course);
    });

    htmlContent += `</div>`; // course-list kapat
    card.innerHTML = htmlContent;
    return card;
}

// Ders Satırı HTML'i
function createCourseRow(course) {
    let namePart = '';

    // Eğer ders "Seçmeli" ise ve bir kodu yoksa (veya türü Seçmeli ise) dropdown göster
    if (course.type === 'Seçmeli') {
        namePart = createElectiveDropdown(course);
    } else {
        // Zorunlu Ders
        namePart = `
            <div class="course-info">
                <span class="course-code">${course.code}</span>
                <span class="course-name">${course.name}</span>
            </div>
        `;
    }

    // Not Seçim Dropdown'ı
    const gradeOptions = Object.keys(gradeScale)
        .filter(k => k !== "")
        .map(g => `<option value="${g}">${g}</option>`)
        .join('');

    return `
        <div class="course-row" data-credit="${course.credit}">
            <div class="credit-badge">${course.credit}</div>
            ${namePart}
            <select class="grade-select">
                <option value="" selected>-</option>
                ${gradeOptions}
            </select>
        </div>
    `;
}

// Seçmeli Ders Dropdown HTML'i
function createElectiveDropdown(slotCourse) {
    // Havuzdaki dersleri listele
    // İsterseniz filtreleme yapabilirsiniz (Örn: Sadece kredisi uyanlar)
    const options = currentElectivePool.map(opt => 
        `<option value="${opt.name}">${opt.code} - ${opt.name}</option>`
    ).join('');

    return `
        <div class="course-info">
            <select class="elective-select">
                <option value="">Seçmeli Ders Seçiniz (${slotCourse.credit} Kredi)</option>
                ${options}
            </select>
            <span class="course-code-hint">Seçmeli</span>
        </div>
    `;
}

// Olay Dinleyicileri (Not değişince hesapla)
function attachEventListeners() {
    const allSelects = document.querySelectorAll('select');
    allSelects.forEach(sel => {
        sel.addEventListener('change', calculateAll);
    });
}

// HESAPLAMA MOTORU
function calculateAll() {
    let grandTotalCredits = 0;
    let grandTotalPoints = 0;

    const cards = document.querySelectorAll('.semester-card');

    cards.forEach(card => {
        let semCredits = 0;
        let semPoints = 0;

        const rows = card.querySelectorAll('.course-row');
        
        rows.forEach(row => {
            const gradeSelect = row.querySelector('.grade-select');
            const gradeLetter = gradeSelect.value;
            const credit = parseFloat(row.dataset.credit);

            // Eğer not seçilmediyse hesaplamaya katma
            if (gradeLetter === "") return;

            // Seçmeli ders kontrolü: Ders seçilmeden not girilirse uyarı verilebilir
            // Şimdilik basit tutuyoruz, not girildiyse hesapla.

            const coefficient = gradeScale[gradeLetter];
            semCredits += credit;
            semPoints += (credit * coefficient);
        });

        // Dönem ortalamasını yaz
        const semGpaDisplay = card.querySelector('.semester-gpa');
        if (semCredits > 0) {
            semGpaDisplay.textContent = `Ort: ${(semPoints / semCredits).toFixed(2)}`;
        } else {
            semGpaDisplay.textContent = `Ort: 0.00`;
        }

        grandTotalCredits += semCredits;
        grandTotalPoints += semPoints;
    });

    // Genel Toplamı Yaz
    totalCreditsEl.textContent = grandTotalCredits;
    if (grandTotalCredits > 0) {
        gpaResultEl.textContent = (grandTotalPoints / grandTotalCredits).toFixed(2);
    } else {
        gpaResultEl.textContent = "0.00";
    }
}