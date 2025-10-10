document.addEventListener('DOMContentLoaded', () => {
    // --- Canvas & Context ---
    const canvas = document.getElementById('simulationCanvas');
    const ctx = canvas.getContext('2d');
    canvas.width = 800;
    canvas.height = 400;

    // --- DOM Elements ---
    const modeSpan = document.getElementById('currentMode');
    const areaSpan = document.getElementById('surfaceArea');
    const countSpan = document.getElementById('absorbedCount');
    const timerSpan = document.getElementById('timer');
    const startRecordBtn = document.getElementById('startRecordBtn');
    const recordStatus = document.getElementById('record-status');
    const allControlButtons = document.querySelectorAll('.controls button');

    // --- Simulation Constants ---
    const BASE_WALL_Y = 300; // 小腸壁的基礎 Y 座標，所有褶皺都從此處向上凸起
    const NUM_GLUCOSE = 5000;
    const GLUCOSE_RADIUS = 0.5;
    const GLUCOSE_SPEED = 1.0;

    // --- Simulation State ---
    let glucoseMolecules = [];
    let currentWall = null;
    let absorbedCount = 0;
    let animationFrameId;
    let timerInterval;
    let elapsedTime = 0;
    let isAutoRecording = false;
    
    // --- Wall Parameters (MODIFIED for upward protrusions) ---
    // [Amplitude, Frequency]
    // 振幅現在表示向外凸出的程度
    const PLICAE_PARAMS = [200, 0.05]; // 環狀褶皺
    const VILLI_PARAMS = [25, 0.5];  // 絨毛
    const MICROVILLI_PARAMS = [5, 2.0]; // 微絨毛

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
            const points = [];
            for (let x = 0; x <= canvas.width; x++) {
                let y_offset = 0; // 每個模式增加的向上偏移量

                // 模式1: 平面 (y_offset 保持 0)
                // 模式2: 環狀褶皺
                if (this.mode === 'plicae' || this.mode === 'plicae_villi' || this.mode === 'plicae_villi_micro') {
                    // 使用 Math.abs 確保波形始終向上，或調整為 (1 - cos(angle))/2 形式的波形
                    y_offset += PLICAE_PARAMS[0] * ((1 - Math.cos(x * PLICAE_PARAMS[1])) / 2);
                }
                // 模式3: 絨毛 (在褶皺基礎上疊加)
                if (this.mode === 'plicae_villi' || this.mode === 'plicae_villi_micro') {
                    y_offset += VILLI_PARAMS[0] * ((1 - Math.cos(x * VILLI_PARAMS[1])) / 2);
                }
                // 模式4: 微絨毛 (在絨毛基礎上疊加)
                if (this.mode === 'plicae_villi_micro') {
                    y_offset += MICROVILLI_PARAMS[0] * ((1 - Math.cos(x * MICROVILLI_PARAMS[1])) / 2);
                }
                
                // 基礎 Y 座標減去向上偏移量，形成向上凸起的表面
                points.push({ x, y: BASE_WALL_Y - y_offset });
            }
            return points;
        }

        draw() {
            ctx.fillStyle = '#DC7864';
            ctx.beginPath();
            ctx.moveTo(0, this.points[0].y);
            this.points.forEach(p => ctx.lineTo(p.x, p.y));
            ctx.lineTo(canvas.width, canvas.height); // 畫到右下角
            ctx.lineTo(0, canvas.height);           // 畫到左下角
            ctx.closePath();
            ctx.fill();
        }

        checkCollision(glucose) {
            if (glucose.x >= 0 && glucose.x < this.points.length) {
                const wallY = this.points[Math.floor(glucose.x)].y;
                // 分子從上方下來，Y值增大。碰到牆壁時，分子的底部Y值 >= 牆壁的Y值
                return glucose.y + glucose.radius >= wallY;
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
            // 分子從上方進入，確保不會生成在牆壁內部
            // 最高的牆壁頂點約在 BASE_WALL_Y - (PLICAE_PARAMS[0] + VILLI_PARAMS[0] + MICROVILLI_PARAMS[0])
            // 為了簡化，生成在頂部一定範圍內
            this.y = Math.random() * (BASE_WALL_Y - (PLICAE_PARAMS[0] + VILLI_PARAMS[0] + MICROVILLI_PARAMS[0]) - 50); 
            if (this.y < 0) this.y = Math.random() * 50; // 避免負值
            
            this.vx = (Math.random() - 0.5) * GLUCOSE_SPEED * 2;
            this.vy = (Math.random() - 0.5) * GLUCOSE_SPEED * 2;
        }

        move() {
            this.x += this.vx;
            this.y += this.vy;
            if (this.x <= this.radius || this.x >= canvas.width - this.radius) this.vx *= -1;
            // 分子上邊界反彈
            if (this.y <= this.radius) this.vy *= -1;
            // 如果分子掉到最底下了 (也就是模擬器畫面外)，讓它重新從上方出現
            if (this.y >= canvas.height) {
                this.y = Math.random() * 50; // 重置到頂部
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
