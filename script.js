document.addEventListener('DOMContentLoaded', () => {
    // --- Canvas & Context ---
    const canvas = document.getElementById('simulationCanvas');
    const ctx = canvas.getContext('2d');
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
    const NUM_GLUCOSE = 150;
    const GLUCOSE_RADIUS = 3;
    const GLUCOSE_SPEED = 1.0;

    // --- Wall Parameters (可在此處調整幅度) ---
    // [Amplitude, Frequency]
    const PLICAE_PARAMS = [80, 0.05]; 
    const VILLI_PARAMS = [25, 0.3];  
    const MICROVILLI_PARAMS = [7, 1.2]; 

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

        // ======================= NEW PERPENDICULAR LOGIC START =======================
        generatePoints() {
            const finalPoints = [];
            const step = 2; // Increase step for performance with complex calculations

            // Helper functions for wave shapes and their derivatives (for calculating slope)
            const wave = (x, amp, freq) => amp * ((1 - Math.cos(x * freq)) / 2);
            const waveDerivative = (x, amp, freq) => (amp * freq / 2) * Math.sin(x * freq);

            for (let x = 0; x <= canvas.width; x += step) {
                // --- Layer 1: Plicae (環狀褶皺) ---
                let p_y = BASE_WALL_Y;
                let p_slope = 0;
                if (this.mode.includes('plicae')) {
                    p_y -= wave(x, PLICAE_PARAMS[0], PLICAE_PARAMS[1]);
                    p_slope -= waveDerivative(x, PLICAE_PARAMS[0], PLICAE_PARAMS[1]);
                }

                // --- Layer 2: Villi (絨毛) ---
                let v_x = x;
                let v_y = p_y;
                let v_slope = p_slope;
                if (this.mode.includes('villi')) {
                    const villi_h = wave(x, VILLI_PARAMS[0], VILLI_PARAMS[1]);
                    const angle = Math.atan(p_slope);
                    const normalAngle = angle - Math.PI / 2; // Angle perpendicular to the slope
                    
                    v_x += villi_h * Math.cos(normalAngle);
                    v_y += villi_h * Math.sin(normalAngle);

                    // For the next layer, the slope is a combination of plicae and villi slopes
                    v_slope += waveDerivative(x, VILLI_PARAMS[0], VILLI_PARAMS[1]);
                }

                // --- Layer 3: Microvilli (微絨毛) ---
                let m_x = v_x;
                let m_y = v_y;
                if (this.mode.includes('microvilli')) {
                    const microvilli_h = wave(x, MICROVILLI_PARAMS[0], MICROVILLI_PARAMS[1]);
                    const angle = Math.atan(v_slope);
                    const normalAngle = angle - Math.PI / 2;
                    
                    m_x += microvilli_h * Math.cos(normalAngle);
                    m_y += microvilli_h * Math.sin(normalAngle);
                }
                
                finalPoints.push({ x: m_x, y: m_y });
            }
            return finalPoints;
        }
        // ======================= NEW PERPENDICULAR LOGIC END =======================

        draw() {
            ctx.fillStyle = '#DC7864';
            ctx.beginPath();
            ctx.moveTo(0, BASE_WALL_Y);
            this.points.forEach(p => ctx.lineTo(p.x, p.y));
            ctx.lineTo(canvas.width, BASE_WALL_Y);
            ctx.lineTo(canvas.width, canvas.height);
            ctx.lineTo(0, canvas.height);
            ctx.closePath();
            ctx.fill();
        }

        checkCollision(glucose) {
            // Simplified collision for performance, as the surface is now non-uniform in X
            for (let i = 0; i < this.points.length - 1; i++) {
                const p1 = this.points[i];
                const p2 = this.points[i+1];
                if (glucose.x > p1.x && glucose.x < p2.x) {
                    // Check distance from particle to the line segment
                    const dist = Math.abs((p2.y - p1.y) * glucose.x - (p2.x - p1.x) * glucose.y + p2.x * p1.y - p2.y * p1.x) /
                                 Math.sqrt(Math.pow(p2.y - p1.y, 2) + Math.pow(p2.x - p1.x, 2));
                    if (dist < glucose.radius) {
                        return true;
                    }
                }
            }
            return false;
        }

        getSurfaceArea() {
            let length = 0;
            for (let i = 0; i < this.points.length - 1; i++) {
                const p1 = this.points[i];
                const p2 = this.points[i + 1];
                length += Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
            }
            return Math.round(length);
        }
    }

    class Glucose { /* ... unchanged ... */ } // Remainder of the script is largely unchanged
    // NOTE: The rest of the script (Glucose class, gameLoop, setSimulationMode, etc.)
    // remains the same as the previous version. I am omitting it here for brevity,
    // but the full code is required for the simulation to run.
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
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
            ctx.fillStyle = '#64B4FF';
            ctx.fill();
        }
    }

    function gameLoop() {
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
    let currentTestIndex = 0;

    function runTestForMode(index) {
        if (index >= modesToTest.length) {
            recordStatus.textContent = "所有模式記錄完成！";
            isAutoRecording = false;
            startRecordBtn.disabled = false;
            allControlButtons.forEach(btn => btn.disabled = false);
            return;
        }
        
        const modeId = modesToTest[index];
        currentTestIndex = index;
        
        document.querySelectorAll('#resultsTable tbody tr').forEach((tr, i) => {
            tr.classList.toggle('running', i === index);
        });
        
        recordStatus.textContent = `正在記錄：${MODES[modeId].name}...`;
        setSimulationMode(modeId);

        setTimeout(() => {
            stopSimulation();
            document.getElementById(`result-${modeId}`).textContent = absorbedCount;
            runTestForMode(index + 1);
        }, 10000);
    }

    startRecordBtn.addEventListener('click', () => {
        isAutoRecording = true;
        startRecordBtn.disabled = true;
        allControlButtons.forEach(btn => btn.disabled = true);
        
        modesToTest.forEach(id => {
            document.getElementById(`result-${id}`).textContent = "---";
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

    setSimulationMode('flat');
});
