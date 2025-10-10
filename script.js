document.addEventListener('DOMContentLoaded', () => {
    // --- Canvas & Context ---
    const canvas = document.getElementById('simulationCanvas');
    // ======================= FINAL FIX: THIS IS THE CRITICAL CORRECTION =======================
    // 將 getContext('d') 這個致命的筆誤修正為正確的 getContext('2d')
    const ctx = canvas.getContext('2d');
    // ========================================================================================
    canvas.width = 800;
    canvas.height = 400;

    // --- DOM Elements & State ---
    const modeSpan = document.getElementById('currentMode');
    const areaSpan = document.getElementById('surfaceArea');
    const countSpan = document.getElementById('absorbedCount');
    const timerSpan = document.getElementById('timer');
    const startRecordBtn = document.getElementById('startRecordBtn');
    const recordStatus = document.getElementById('record-status');
    const allControlButtons = document.querySelectorAll('.controls button');
    let glucoseMolecules = [], currentWall = null, absorbedCount = 0;
    let animationFrameId, timerInterval, elapsedTime = 0, isAutoRecording = false;

    // --- Simulation Constants ---
    const BASE_WALL_Y = 320; 
    const NUM_GLUCOSE = 2000;
    const GLUCOSE_RADIUS = 0.5;
    const GLUCOSE_SPEED = 4.0;

    // --- Wall Parameters ---
    const PLICAE_PARAMS = [200, 0.09];
    const VILLI_PARAMS = [10, 0.5];
    const MICROVILLI_PARAMS = [3, 0.5];

    const MODES = {
        'flat': { name: '平面' },
        'plicae': { name: '環狀褶皺' },
        'plicae_villi': { name: '褶皺+絨毛' },
        'plicae_villi_micro': { name: '褶皺+絨毛+微絨毛' }
    };

    class IntestinalWall {
        constructor(mode) {
            this.mode = mode;
            this.points = this.generatePoints();
        }

        generatePoints() {
            if (this.mode === 'flat') {
                return [{x: 0, y: BASE_WALL_Y}, {x: canvas.width, y: BASE_WALL_Y}];
            }
        
            const finalPoints = [];
            const step = 2;
            const wave = (x, amp, freq) => amp * ((1 - Math.cos(x * freq)) / 2);
        
            let prev_layer1_point = { x: 0, y: BASE_WALL_Y };
            let prev_layer2_point = { x: 0, y: BASE_WALL_Y };
        
            finalPoints.push({ x: 0, y: BASE_WALL_Y });
        
            for (let x = step; x <= canvas.width; x += step) {
                let layer1_point = { x: x, y: BASE_WALL_Y };
                if (this.mode === 'plicae' || this.mode === 'plicae_villi' || this.mode === 'plicae_villi_micro') {
                    layer1_point.y -= wave(x, PLICAE_PARAMS[0], PLICAE_PARAMS[1]);
                }
                
                let point_for_this_iteration = layer1_point;
                let layer2_point = layer1_point;

                if (this.mode === 'plicae_villi' || this.mode === 'plicae_villi_micro') {
                    const slope1 = (layer1_point.y - prev_layer1_point.y) / (layer1_point.x - prev_layer1_point.x);
                    const angle1 = Math.atan(slope1);
                    const normalAngle1 = angle1 - Math.PI / 2;
                    const offset1 = wave(x, VILLI_PARAMS[0], VILLI_PARAMS[1]);
                    
                    layer2_point = {
                        x: layer1_point.x + offset1 * Math.cos(normalAngle1),
                        y: layer1_point.y + offset1 * Math.sin(normalAngle1)
                    };
                    point_for_this_iteration = layer2_point;
                }

                if (this.mode === 'plicae_villi_micro') {
                    const slope2 = (layer2_point.y - prev_layer2_point.y) / (layer2_point.x - prev_layer2_point.x);
                    const angle2 = isFinite(slope2) ? Math.atan(slope2) : (layer2_point.y > prev_layer2_point.y ? Math.PI / 2 : -Math.PI / 2);
                    const normalAngle2 = angle2 - Math.PI / 2;
                    const offset2 = wave(x, MICROVILLI_PARAMS[0], MICROVILLI_PARAMS[1]);

                    const layer3_point = {
                        x: layer2_point.x + offset2 * Math.cos(normalAngle2),
                        y: layer2_point.y + offset2 * Math.sin(normalAngle2)
                    };
                    point_for_this_iteration = layer3_point;
                }

                finalPoints.push(point_for_this_iteration);
                prev_layer1_point = layer1_point;
                prev_layer2_point = layer2_point;
            }
            return finalPoints;
        }

        draw() {
            if (!ctx) return; // Safety check
            ctx.fillStyle = '#DC7864';
            ctx.beginPath();
            ctx.moveTo(0, canvas.height);
            ctx.lineTo(0, BASE_WALL_Y);
            if (this.points.length > 1) {
                this.points.forEach(p => ctx.lineTo(p.x, p.y));
                ctx.lineTo(this.points[this.points.length - 1].x, canvas.height);
            } else {
                 ctx.lineTo(canvas.width, BASE_WALL_Y);
                 ctx.lineTo(canvas.width, canvas.height);
            }
            ctx.closePath();
            ctx.fill();
        }

        checkCollision(glucose) {
            for (let i = 0; i < this.points.length - 1; i++) {
                const p1 = this.points[i];
                const p2 = this.points[i + 1];
        
                if (glucose.x < Math.min(p1.x, p2.x) - glucose.radius || glucose.x > Math.max(p1.x, p2.x) + glucose.radius ||
                    glucose.y < Math.min(p1.y, p2.y) - glucose.radius || glucose.y > Math.max(p1.y, p2.y) + glucose.radius) {
                    continue;
                }
        
                const dx = p2.x - p1.x;
                const dy = p2.y - p1.y;
                const l2 = dx * dx + dy * dy;
        
                if (l2 === 0) {
                    if (Math.hypot(glucose.x - p1.x, glucose.y - p1.y) < glucose.radius) return true;
                    continue;
                }
        
                let t = ((glucose.x - p1.x) * dx + (glucose.y - p1.y) * dy) / l2;
                t = Math.max(0, Math.min(1, t));
        
                const closestX = p1.x + t * dx;
                const closestY = p1.y + t * dy;
                
                if (Math.hypot(glucose.x - closestX, glucose.y - closestY) < glucose.radius) {
                    return true;
                }
            }
            return false;
        }

        getSurfaceArea() {
            let length = 0;
            for (let i = 0; i < this.points.length - 1; i++) {
                const p1 = this.points[i];
                const p2 = this.points[i + 1];
                length += Math.hypot(p2.x - p1.x, p2.y - p1.y);
            }
            return Math.round(length);
        }
    }

    class Glucose {
        constructor() {
            this.radius = GLUCOSE_RADIUS;
            this.x = Math.random() * canvas.width;
            const highestPoint = BASE_WALL_Y - (PLICAE_PARAMS[0] + VILLI_PARAMS[0] + MICROVILLI_PARAMS[0]);
            this.y = Math.random() * (highestPoint - 50); 
            if (this.y < this.radius) this.y = this.radius + Math.random() * 50;
            this.vx = (Math.random() - 0.5) * GLUCOSE_SPEED * 2;
            this.vy = (Math.random() - 0.5) * GLUCOSE_SPEED * 2;
        }

        move() {
            this.x += this.vx;
            this.y += this.vy;
            if (this.x <= this.radius || this.x >= canvas.width - this.radius) this.vx *= -1;
            if (this.y <= this.radius) this.vy *= -1;
            if (this.y >= canvas.height) {
                this.y = this.radius;
                this.x = Math.random() * canvas.width;
            }
        }

        draw() {
            if (!ctx) return; // Safety check
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
            ctx.fillStyle = '#64B4FF';
            ctx.fill();
        }
    }

    function gameLoop() {
        if (!ctx) return; // Safety check
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        currentWall.draw();
        
        for (let i = glucoseMolecules.length - 1; i >= 0; i--) {
            const glucose = glucoseMolecules[i];
            glucose.move();
            glucose.draw();
            
            if (currentWall.checkCollision(glucose)) {
                glucoseMolecules.splice(i, 1);
                absorbedCount++;
                countSpan.textContent = absorbedCount;
            }
        }
        animationFrameId = requestAnimationFrame(gameLoop);
    }

    function setSimulationMode(mode) {
        if (!MODES[mode]) return;
        stopSimulation();
        currentWall = new IntestinalWall(mode); 
        modeSpan.textContent = MODES[mode].name;
        areaSpan.textContent = currentWall.getSurfaceArea();
        glucoseMolecules = Array.from({ length: NUM_GLUCOSE }, () => new Glucose());
        absorbedCount = 0;
        countSpan.textContent = 0;
        startTimer();
        animationFrameId = requestAnimationFrame(gameLoop);
    }

    function stopSimulation() {
        if (animationFrameId) cancelAnimationFrame(animationFrameId);
        if (timerInterval) clearInterval(timerInterval);
        animationFrameId = null;
        timerInterval = null;
    }

    function startTimer() {
        elapsedTime = 0;
        timerSpan.textContent = "0.0";
        const startTime = Date.now();
        timerInterval = setInterval(() => {
            elapsedTime = (Date.now() - startTime) / 1000;
            timerSpan.textContent = elapsedTime.toFixed(1);
        }, 100);
    }

    const modesToTest = ['flat', 'plicae', 'plicae_villi', 'plicae_villi_micro'];

    function runTestForMode(index) {
        if (index >= modesToTest.length) {
            recordStatus.textContent = "所有模式記錄完成！";
            isAutoRecording = false;
            startRecordBtn.disabled = false;
            allControlButtons.forEach(btn => btn.disabled = false);
            return;
        }
        const modeId = modesToTest[index];
        document.querySelectorAll('#resultsTable tbody tr').forEach((tr, i) => {
            tr.classList.toggle('running', i === index);
        });
        recordStatus.textContent = `正在記錄：${MODES[modeId].name}...`;
        setSimulationMode(modeId);
        setTimeout(() => {
            stopSimulation();
            const resultCell = document.getElementById(`result-${modeId}`);
            if (resultCell) {
                resultCell.textContent = absorbedCount;
            } else {
                console.error("Could not find result cell for ID:", `result-${modeId}`);
            }
            runTestForMode(index + 1);
        }, 10000);
    }

    startRecordBtn.addEventListener('click', () => {
        isAutoRecording = true;
        startRecordBtn.disabled = true;
        allControlButtons.forEach(btn => btn.disabled = true);
        modesToTest.forEach(id => {
            const resultCell = document.getElementById(`result-${id}`);
            if (resultCell) {
                resultCell.textContent = "---";
            }
        });
        runTestForMode(0);
    });

    const quizSelects = document.querySelectorAll('.quiz-section select');
    const correctOrder = ['plicae_villi_micro', 'plicae_villi', 'plicae', 'flat'];

    function checkAnswers() {
        const q1Selects = [
            document.getElementById('q1-ans1').value,
            document.getElementById('q1-ans2').value,
            document.getElementById('q1-ans3').value,
            document.getElementById('q1-ans4').value,
        ];
        const isQ1Correct = q1Selects.every((val, i) => val === correctOrder[i]);
        const isQ2Correct = document.getElementById('q2-ans').value === 'helpful';
        nextBtn.disabled = !(isQ1Correct && isQ2Correct);
    }
    quizSelects.forEach(s => s.addEventListener('change', checkAnswers));
    
    document.getElementById('mode1Btn').addEventListener('click', () => setSimulationMode('flat'));
    document.getElementById('mode2Btn').addEventListener('click', () => setSimulationMode('plicae'));
    document.getElementById('mode3Btn').addEventListener('click', () => setSimulationMode('plicae_villi'));
    document.getElementById('mode4Btn').addEventListener('click', () => setSimulationMode('plicae_villi_micro'));
    document.getElementById('prevBtn').addEventListener('click', () => alert('這是上一頁'));
    document.getElementById('homeBtn').addEventListener('click', () => alert('這是回到首頁'));
    document.getElementById('nextBtn').addEventListener('click', () => alert('恭喜你答對了！即將前往下一頁！'));

    // Initial load
    if (ctx) {
      setSimulationMode('flat');
    } else {
      console.error("Canvas context is not available. Simulation cannot start.");
      alert("錯誤：無法初始化繪圖環境！");
    }
});
