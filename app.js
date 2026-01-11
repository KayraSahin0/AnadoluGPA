import { facultiesInfo } from './faculties.js';
import { fetchDepartmentData, gradeScale } from './data.js';

const facultySelect = document.getElementById('facultySelect');
const departmentSelect = document.getElementById('departmentSelect');
const semestersContainer = document.getElementById('semestersContainer');
const totalCreditsEl = document.getElementById('totalCredits');
const gpaResultEl = document.getElementById('gpaResult');
const loadingIndicator = document.getElementById('loadingIndicator');

let currentElectivePools = {}; 


document.addEventListener('DOMContentLoaded', () => {
    facultySelect.innerHTML = '<option value="">Fakülte Seçiniz...</option>';
    Object.keys(facultiesInfo).forEach(facultyName => {
        const option = document.createElement('option');
        option.value = facultyName;
        option.textContent = facultyName;
        facultySelect.appendChild(option);
    });
});

facultySelect.addEventListener('change', (e) => {
    const selectedFaculty = e.target.value;
    
    departmentSelect.innerHTML = '<option value="">Önce Fakülte Seçiniz</option>';
    departmentSelect.disabled = true;
    semestersContainer.innerHTML = '';
    resetResults();

    if (selectedFaculty && facultiesInfo[selectedFaculty]) {
        departmentSelect.innerHTML = '<option value="">Bölüm Seçiniz...</option>';
        const departments = facultiesInfo[selectedFaculty];
        
        Object.entries(departments).forEach(([deptCode, deptName]) => {
            const option = document.createElement('option');
            option.value = deptCode;
            option.textContent = deptName;
            departmentSelect.appendChild(option);
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


function renderSemesters(semesters) {
    semestersContainer.innerHTML = '';
    
    for (const [semId, courses] of Object.entries(semesters)) {
        if (courses.length === 0) continue;

        const card = document.createElement('div');
        card.className = 'semester-card';
        
        let rowsHtml = '';
        courses.forEach(course => {
            if (course.type === 'Zorunlu') {
                rowsHtml += createNormalRow(course);
            } else {
                rowsHtml += createElectiveRow(course);
            }
        });

        card.innerHTML = `
            <div class="semester-header">
                <span>${semId}. Yarıyıl</span>
                <span class="semester-gpa">Ort: 0.00</span>
            </div>
            <div class="course-list">
                ${rowsHtml}
            </div>
        `;
        semestersContainer.appendChild(card);
    }
    
    // HATA BURADAYDI: İsim birleştirildi
    attachCalculationListeners(); 
    calculateAll();
}

function createNormalRow(course) {
    return `
        <div class="course-row" data-credit="${course.credit}">
            <div class="credit-badge">${course.credit}</div>
            <div class="course-info">
                <span class="course-code">${course.code}</span>
                <span class="course-name">${course.name}</span>
            </div>
            ${createGradeSelectHtml()}
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
            ${createGradeSelectHtml()}
        </div>
    `;
}

function createGradeSelectHtml() {
    const options = Object.keys(gradeScale)
        .filter(key => key !== "")
        .map(grade => `<option value="${grade}">${grade}</option>`)
        .join('');

    return `
        <select class="grade-select">
            <option value="" selected>-</option>
            ${options}
        </select>
    `;
}


function attachCalculationListeners() {
    const inputs = document.querySelectorAll('select');
    inputs.forEach(input => {
        input.addEventListener('change', calculateAll);
    });
}

function calculateAll() {
    let grandTotalCredits = 0;
    let grandTotalPoints = 0;

    document.querySelectorAll('.semester-card').forEach(card => {
        let semCredits = 0;
        let semPoints = 0;

        card.querySelectorAll('.course-row').forEach(row => {
            const credit = parseFloat(row.dataset.credit);
            const gradeSelect = row.querySelector('.grade-select');
            
            if (!gradeSelect || gradeSelect.value === "") return;

            const gradeLetter = gradeSelect.value;
            const coefficient = gradeScale[gradeLetter];

            semCredits += credit;
            semPoints += (credit * coefficient);
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
    
    if (grandTotalCredits > 0) {
        gpaResultEl.textContent = (grandTotalPoints / grandTotalCredits).toFixed(2);
    } else {
        gpaResultEl.textContent = "0.00";
    }
}

function resetResults() {
    totalCreditsEl.textContent = "0";
    gpaResultEl.textContent = "0.00";
}