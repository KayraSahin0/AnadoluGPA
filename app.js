// app.js - AKILLI SEÇMELİ DERS MANTIĞI

import { facultiesInfo } from './faculties.js';
import { fetchDepartmentData, gradeScale } from './data.js';

const facultySelect = document.getElementById('facultySelect');
const departmentSelect = document.getElementById('departmentSelect');
const semestersContainer = document.getElementById('semestersContainer');
const totalCreditsEl = document.getElementById('totalCredits');
const gpaResultEl = document.getElementById('gpaResult');
const loadingIndicator = document.getElementById('loadingIndicator');

let currentElectivePools = {}; 

// --- Event Listeners ---
document.addEventListener('DOMContentLoaded', () => {
    facultySelect.innerHTML = '<option value="">Fakülte Seçiniz...</option>';
    Object.keys(facultiesInfo).forEach(fac => {
        const opt = document.createElement('option');
        opt.value = fac; opt.textContent = fac;
        facultySelect.appendChild(opt);
    });
});

facultySelect.addEventListener('change', (e) => {
    const selectedFac = e.target.value;
    departmentSelect.innerHTML = '<option value="">Önce Fakülte Seçiniz</option>';
    departmentSelect.disabled = true;
    semestersContainer.innerHTML = '';
    resetResults();

    if (selectedFac && facultiesInfo[selectedFac]) {
        departmentSelect.innerHTML = '<option value="">Bölüm Seçiniz...</option>';
        Object.entries(facultiesInfo[selectedFac]).forEach(([code, name]) => {
            const opt = document.createElement('option');
            opt.value = code; opt.textContent = name;
            departmentSelect.appendChild(opt);
        });
        departmentSelect.disabled = false;
    }
});

departmentSelect.addEventListener('change', async (e) => {
    const deptCode = e.target.value;
    if (!deptCode) return;
    loadingIndicator.style.display = 'block';
    semestersContainer.style.opacity = '0.5';
    const data = await fetchDepartmentData(deptCode);
    loadingIndicator.style.display = 'none';
    semestersContainer.style.opacity = '1';
    
    if (data) {
        currentElectivePools = data.electivePools;
        renderSemesters(data.semesters);
    }
});

// --- RENDER MANTIĞI ---

function renderSemesters(semesters) {
    semestersContainer.innerHTML = '';
    
    for (const [semId, courses] of Object.entries(semesters)) {
        if (courses.length === 0) continue;

        const card = document.createElement('div');
        card.className = 'semester-card';
        
        let contentHtml = '';
        
        courses.forEach((course, index) => {
            // Eğer ders Zorunlu ise normal satır bas
            if (course.type === 'Zorunlu Dersler') {
                contentHtml += createNormalRow(course);
            } else {
                // Eğer Seçmeli ise "Grup" oluştur (Kredi Havuzu Mantığı)
                // Benzersiz bir ID veriyoruz ki olayları takip edebilelim
                const groupId = `group-${semId}-${index}`;
                contentHtml += createElectiveGroupHtml(course, groupId);
            }
        });

        card.innerHTML = `
            <div class="semester-header">
                <span>${semId}. Yarıyıl</span>
                <span class="semester-gpa">Ort: 0.00</span>
            </div>
            <div class="course-list">
                ${contentHtml}
            </div>
        `;
        semestersContainer.appendChild(card);
    }
    
    // HTML oluştuktan sonra, dinamik seçmeli ders mantığını başlat
    initElectiveLogic();
    attachCalculationListeners();
    calculateAll();
}

// 1. Zorunlu Ders Satırı
function createNormalRow(course) {
    return `
        <div class="course-row normal-row" data-credit="${course.credit}">
            <div class="credit-badge">${course.credit}</div>
            <div class="course-info">
                <span class="course-code">${course.code}</span>
                <span class="course-name">${course.name}</span>
            </div>
            ${createGradeActionsHtml()} </div>
    `;
}

// 2. Seçmeli Ders GRUBU (Container)
function createElectiveGroupHtml(slotCourse, groupId) {
    // Bu, Excel'deki o satırı bir "Kutu"ya çevirir.
    // data-target-credit="10.5" gibi hedef krediyi tutar.
    return `
        <div class="elective-group" id="${groupId}" data-target-credit="${slotCourse.credit}" data-type="${slotCourse.type}">
            <div class="group-header">
                <span class="group-title">${slotCourse.type} Alanı</span>
                <span class="credit-status">Hedef: ${slotCourse.credit} Kredi</span>
            </div>
            <div class="group-rows-container">
                </div>
        </div>
    `;
}

function createElectiveRow(course) {
    const pool = currentElectivePools[course.type] || [];
    const options = pool.map(c => 
        `<option value="${c.name}">${c.code} - ${c.name}</option>`
    ).join('');

    return `
        <div class="course-row" data-credit="${course.credit}">
            <div class="credit-badge">${course.credit}</div>
            <div class="course-info">
                <select class="elective-select">
                    <option value="">${course.type} Seçiniz...</option>
                    ${options}
                </select>
                <span class="course-code-hint">${course.type}</span>
            </div>
             ${createGradeActionsHtml()} </div>
    `;
}

function createElectiveDropdownRow(type) {
    const pool = currentElectivePools[type] || [];
    const options = pool.map(c => 
        `<option value="${c.name}" data-credit="${c.credit}">${c.code} - ${c.name} (${c.credit} Kr)</option>`
    ).join('');

    return `
        <div class="course-row elective-row" data-credit="0">
            <div class="credit-badge">-</div>
            <div class="course-info">
                <select class="elective-select">
                    <option value="" data-credit="0">${type} Seçiniz...</option>
                    ${options}
                </select>
            </div>
             ${createGradeActionsHtml()} </div>
    `;
}

function createGradeSelectHtml() {
    const options = Object.keys(gradeScale).filter(k=>k).map(g=>`<option value="${g}">${g}</option>`).join('');
    return `<select class="grade-select"><option value="">-</option>${options}</select>`;
}

// --- AKILLI SEÇMELİ DERS YÖNETİMİ ---

function initElectiveLogic() {
    // Tüm seçmeli grupları bul ve ilk boş satırlarını ekle
    document.querySelectorAll('.elective-group').forEach(group => {
        // Eğer içi boşsa bir tane ekle
        if (group.querySelector('.group-rows-container').children.length === 0) {
            addElectiveRowToGroup(group);
        }
    });
    preventDuplicateSelections();
}

function addElectiveRowToGroup(groupElement) {
    const container = groupElement.querySelector('.group-rows-container');
    const type = groupElement.dataset.type;
    
    // Yeni satır HTML'ini oluştur
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = createElectiveDropdownRow(type);
    const newRow = tempDiv.firstElementChild;
    
    // Olay dinleyicisi ekle (Ders seçilince çalışacak)
    const select = newRow.querySelector('.elective-select');
    select.addEventListener('change', () => {
        updateGroupStatus(groupElement);
        preventDuplicateSelections();
        calculateAll();
    });

    // Not değişince de hesapla
    newRow.querySelector('.grade-select').addEventListener('change', calculateAll);

    container.appendChild(newRow);
    preventDuplicateSelections();
}

function updateGroupStatus(groupElement) {
    const targetCredit = parseFloat(groupElement.dataset.targetCredit);
    const rows = groupElement.querySelectorAll('.elective-row');
    let currentTotal = 0;

    // Seçili derslerin kredilerini topla
    rows.forEach(row => {
        const select = row.querySelector('.elective-select');
        const selectedOption = select.options[select.selectedIndex];
        const credit = parseFloat(selectedOption.dataset.credit) || 0;
        
        // Satırın kredisini güncelle (Rozet ve veri)
        row.dataset.credit = credit;
        row.querySelector('.credit-badge').textContent = credit > 0 ? credit : '-';
        
        currentTotal += credit;
    });

    // Durum yazısını güncelle
    const statusSpan = groupElement.querySelector('.credit-status');
    const remaining = targetCredit - currentTotal;
    
    if (remaining > 0) {
        statusSpan.textContent = `Seçilen: ${currentTotal} / Hedef: ${targetCredit} (Kalan: ${remaining})`;
        statusSpan.style.color = "#d11242"; // Kırmızımsı (Tamamlanmadı)
        
        // Eğer son satır doluysa ve hala kredi lazımsa, YENİ SATIR EKLE
        const lastRow = rows[rows.length - 1];
        const lastSelect = lastRow.querySelector('.elective-select');
        if (lastSelect.value !== "") {
            addElectiveRowToGroup(groupElement);
        }
    } else if (remaining === 0) {
        statusSpan.textContent = `Tamamlandı: ${currentTotal} / ${targetCredit}`;
        statusSpan.style.color = "green";
    } else {
        statusSpan.textContent = `DİKKAT: Fazla Seçildi (${currentTotal} / ${targetCredit})`;
        statusSpan.style.color = "red";
    }
}

// --- HESAPLAMA ---

function attachCalculationListeners() {
    // 1. Ana Not Kutularını (Yeni Not) Dinle
    const mainSelects = document.querySelectorAll('.grade-select');
    mainSelects.forEach(input => {
        input.removeEventListener('change', calculateAll);
        input.addEventListener('change', calculateAll);
    });

    // 2. Ders Seçim Kutularını Dinle
    const electiveSelects = document.querySelectorAll('.elective-select');
    electiveSelects.forEach(input => {
        input.removeEventListener('change', calculateAll);
        input.addEventListener('change', calculateAll);
    });

    // 3. Tekrar Butonlarını Dinle
    const repeatBtns = document.querySelectorAll('.repeat-btn');
    repeatBtns.forEach(btn => {
        // Butonun davranışını sıfırla ve yeniden tanımla
        btn.onclick = null; 
        btn.onclick = function() {
            const parent = this.parentElement; 
            const oldGradeSelect = parent.querySelector('.old-grade-select');
            
            this.classList.toggle('active');
            
            if (this.classList.contains('active')) {
                // Butona basılınca Eski Not kutusunu AÇ
                oldGradeSelect.style.display = 'block';
                oldGradeSelect.focus();
            } else {
                // Kapatılınca GİZLE ve SIFIRLA
                oldGradeSelect.style.display = 'none';
                oldGradeSelect.value = ""; 
            }
        };
    });
}

function calculateAll() {
    let grandTotalCredits = 0;
    let grandTotalPoints = 0;

    document.querySelectorAll('.semester-card').forEach(card => {
        let semCredits = 0;
        let semPoints = 0;

        // Hem normal hem seçmeli satırları gez
        card.querySelectorAll('.course-row').forEach(row => {
            const gradeSelect = row.querySelector('.grade-select');
            
            // Not seçili değilse veya ders seçili değilse atla
            if (!gradeSelect || gradeSelect.value === "") return;
            
            // Krediyi dataset'ten al (Seçmeli derslerde bu dinamik güncelleniyor)
            const credit = parseFloat(row.dataset.credit);
            
            if (credit > 0) {
                const gradeLetter = gradeSelect.value;
                const coefficient = gradeScale[gradeLetter];
                
                semCredits += credit;
                semPoints += (credit * coefficient);
            }
        });

        const semGpaDisplay = card.querySelector('.semester-gpa');
        if (semCredits > 0) {
            semGpaDisplay.textContent = `Ort: ${(semPoints / semCredits).toFixed(2)}`;
        } else {
            semGpaDisplay.textContent = `Ort: 0.00`;
        }

        grandTotalCredits += semCredits;
        grandTotalPoints += semPoints;
    });

    totalCreditsEl.textContent = grandTotalCredits;
    gpaResultEl.textContent = grandTotalCredits > 0 ? (grandTotalPoints / grandTotalCredits).toFixed(2) : "0.00";
}

function resetResults() {
    totalCreditsEl.textContent = "0";
    gpaResultEl.textContent = "0.00";
}

function preventDuplicateSelections() {
    // 1. Tüm seçmeli ders kutularını ve seçilmiş değerleri bul
    const allSelects = document.querySelectorAll('.elective-select');
    const selectedValues = [];
    
    allSelects.forEach(sel => {
        if (sel.value) selectedValues.push(sel.value);
    });

    // 2. Her kutuyu gez ve seçilmiş olanları diğerlerinde kilitle
    allSelects.forEach(sel => {
        const currentVal = sel.value; // Bu kutunun kendi seçimi (bunu kilitlememeliyiz)
        
        Array.from(sel.options).forEach(opt => {
            // Boş seçenek (-) hariç kontrol et
            if (opt.value === "") return;

            // Kural: Eğer bu ders listede varsa VE bu kutunun kendi seçimi değilse
            if (selectedValues.includes(opt.value) && opt.value !== currentVal) {
                opt.disabled = true; // Tıklanamaz yap
                opt.style.color = "#ccc"; // Gri renk yap (görsel olarak belli olsun)
                // İsterseniz listeden tamamen silmek için: opt.hidden = true; satırını kullanabilirsiniz.
            } else {
                opt.disabled = false; // Tekrar aç
                opt.style.color = ""; 
            }
        });
    });
}

// Tekrar butonu ve not kutularını oluşturan ortak fonksiyon
function createGradeActionsHtml() {
    // 1. Tekrar Butonu
    const repeatIcon = `
    <button class="repeat-btn" title="Ders Tekrarı Yapıyorum">
        <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
            <path d="M7 7h10v3l4-4-4-4v3H5v6h2V7zm10 10H7v-3l-4 4 4 4v-3h12v-6h-2v4z"/>
        </svg>
    </button>`;

    // 2. Eski Not Kutusu (Küçük ve belirgin)
    // Başlığı "Eski" olarak ayarladık
    const oldGradeOptions = Object.keys(gradeScale)
        .filter(k => k !== "")
        .map(g => `<option value="${g}">${g}</option>`)
        .join('');
    
    const oldGradeSelect = `
        <select class="old-grade-select" title="Eski Notunuz">
            <option value="" selected>Eski</option>
            ${oldGradeOptions}
        </select>
    `;

    // 3. Yeni Not Kutusu (Mevcut fonksiyonu çağırıyoruz)
    const currentGradeSelect = createGradeSelectHtml(); 

    // SIRALAMA ÖNEMLİ: Buton -> Eski Not -> Yeni Not
    return `
        <div class="grade-actions">
            ${repeatIcon}
            ${oldGradeSelect}
            ${currentGradeSelect}
        </div>
    `;
}