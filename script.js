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

        // ======================= NEWEST PERPENDICULAR LOGIC START =======================
        generatePoints() {
            if (this.mode === 'flat') {
                return [{x: 0, y: BASE_WALL_Y}, {x: canvas.width, y: BASE_WALL_Y}];
            }
        
            const finalPoints = [];
            const step = 2; // Step for calculation, smaller is more precise but slower
            const wave = (x, amp, freq) => amp * ((1 - Math.cos(x * freq)) / 2);
        
            // Store the previous point of each layer to calculate the slope
            let prev_layer1_point = { x: 0, y: BASE_WALL_Y }; // Plicae surface
            let prev_layer2_point = { x: 0, y: BASE_WALL_Y }; // Villi surface
        
            finalPoints.push({ x: 0, y: BASE_WALL_Y });
        
            for (let x = step; x <= canvas.width; x += step) {
                // --- Layer 1: Plicae surface ---
                let layer1_point = { x: x, y: BASE_WALL_Y - wave(x, PLICAE_PARAMS[0], PLICAE_PARAMS[1]) };
                if (this.mode === 'plicae') {
                    finalPoints.push(layer1_point);
                    prev_layer1_point = layer1_point;
                    continue;
                }
        
                // --- Layer 2: Villi surface (protruding from Layer 1) ---
                const slope_layer1 = (layer1_point.y - prev_layer1_point.y) / (layer1_point.x - prev_layer1_point.x);
                const angle1 = Math.atan(slope_layer1);
                const normalAngle1 = angle1 - Math.PI / 2;
                const offset1 = wave(x, VILLI_PARAMS[0], VILLI_PARAMS[1]);
                
                let layer2_point = {
                    x: layer1_point.x + offset1 * Math.cos(normalAngle1),
                    y: layer1_point.y + offset1 * Math.sin(normalAngle1)
                };

                if (this.mode === 'plicae_villi') {
                    finalPoints.push(layer2_point);
                    prev_layer1_point = layer1_point;
                    prev_layer2_point = layer2_point;
                    continue;
                }
        
                // --- Layer 3: Microvilli surface (protruding from Layer 2) ---
                const slope_layer2 = (layer2_point.y - prev_layer2_point.y) / (layer2_point.x - prev_layer2_point.x);
                const angle2 = Math.atan(slope_layer2);
                const normalAngle2 = angle2 - Math.PI / 2;
                const offset2 = wave(x, MICROVILLI_PARAMS[0], MICROVILLI_PARAMS[1]);

                let finalPoint = {
                    x: layer2_point.x + offset2 * Math.cos(normalAngle2),
                    y: layer2_point.y + offset2 * Math.sin(normalAngle2)
                };

                if (this.mode === 'plicae_villi_micro') {
                    finalPoints.push(finalPoint);
                }

                // Update previous points for the next iteration's slope calculation
                prev_layer1_point = layer1_point;
                prev_layer2_point = layer2_point;
            }
            return finalPoints;
        }
        // ======================= NEWEST PERPENDICULAR LOGIC END =======================

        draw() {
            ctx.fillStyle = '#DC7864';
            ctx.beginPath();
            ctx.moveTo(0, canvas.height);
            ctx.lineTo(0, BASE_WALL_Y);
            this.points.forEach(p => ctx.lineTo(p.x, p.y));
            ctx.lineTo(canvas.width, BASE_WALL_Y);
            ctx.lineTo(canvas.width, canvas.height);
            ctx.closePath();
            ctx.fill();
        }

        checkCollision(glucose) {
            // Use a simplified but effective check for performance
            const x_index = Math.round(glucose.x / 2); // Match the step used in generatePoints
            if (x_index >= 0 && x_index < this.points.length) {
                const wallPoint = this.points[x_index];
                if (wallPoint) {
                    const dx = glucose.x - wallPoint.x;
                    const dy = glucose.y - wallPoint.y;
                    if (Math.sqrt(dx * dx + dy * dy) < glucose.radius + 3) { // Use a slightly larger radius for better collision
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
        // ... (The rest of the file is unchanged)
        if (!MODES[mode]) return;
        
        stopSimulation();
        // A hack to make mode keys like 'plicae_villi' work with .includes()
        let modeKey = mode;
        if(mode === 'plicae') modeKey = 'plicae';
        if(mode === 'plicae_villi') modeKey = 'plicae villi';
        if(mode === 'plicae_villi_micro') modeKey = 'plicae villi microvilli';

        currentWall = new IntestinalWall(modeKey);
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
