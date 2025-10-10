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
    const nextBtn = document.getElementById('nextBtn');
    
    // Quiz Elements
    const q1Ans1 = document.getElementById('q1-ans1');
    const q1Ans2 = document.getElementById('q1-ans2');
    const q1Ans3 = document.getElementById('q1-ans3');
    const q2Ans = document.getElementById('q2-ans');
    const q1Feedback = document.getElementById('q1-feedback');
    const q2Feedback = document.getElementById('q2-feedback');

    // --- Simulation Constants ---
    const WALL_Y_POSITION = 350;
    const NUM_GLUCOSE = 100;
    const GLUCOSE_RADIUS = 4;
    const GLUCOSE_SPEED = 0.8;

    // --- Simulation State ---
    let glucoseMolecules = [];
    let currentWall = null;
    let absorbedCount = 0;
    let animationFrameId;

    // --- Wall Class ---
    class IntestinalWall {
        constructor(mode) {
            this.mode = mode;
            this.y_pos = WALL_Y_POSITION;
            this.points = this.generatePoints();
        }

        generatePoints() {
            const points = [];
            const V_AMP = 30, V_FREQ = 0.1; // Villi
            const MV_AMP = 5, MV_FREQ = 0.8; // Microvilli
            
            for (let x = 0; x <= canvas.width; x++) {
                let y = this.y_pos;
                if (this.mode === 'villi' || this.mode === 'villi_micro') {
                    y += V_AMP * Math.sin(x * V_FREQ);
                }
                if (this.mode === 'villi_micro') {
                    y += MV_AMP * Math.sin(x * MV_FREQ);
                }
                points.push({ x, y });
            }
            return points;
        }

        draw() {
            ctx.fillStyle = '#DC7864'; // Wall color
            ctx.beginPath();
            ctx.moveTo(0, this.points[0].y);
            for (const point of this.points) {
                ctx.lineTo(point.x, point.y);
            }
            ctx.lineTo(canvas.width, canvas.height);
            ctx.lineTo(0, canvas.height);
            ctx.closePath();
            ctx.fill();
        }

        checkCollision(glucose) {
            if (glucose.x >= 0 && glucose.x < this.points.length) {
                const wallY = this.points[Math.floor(glucose.x)].y;
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

    // --- Glucose Class ---
    class Glucose {
        constructor() {
            this.radius = GLUCOSE_RADIUS;
            this.x = Math.random() * canvas.width;
            this.y = Math.random() * (WALL_Y_POSITION - 100);
            this.vx = (Math.random() - 0.5) * GLUCOSE_SPEED * 2;
            this.vy = (Math.random() - 0.5) * GLUCOSE_SPEED * 2;
        }

        move() {
            this.x += this.vx;
            this.y += this.vy;
            if (this.x <= this.radius || this.x >= canvas.width - this.radius) this.vx *= -1;
            if (this.y <= this.radius) this.vy *= -1;
            if (this.y >= WALL_Y_POSITION - this.radius) {
                this.y = WALL_Y_POSITION - this.radius;
                this.vy *= -1;
            }
        }

        draw() {
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
            ctx.fillStyle = '#64B4FF'; // Glucose color
            ctx.fill();
        }
    }
    
    // --- Main Simulation Loop ---
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
    
    // --- Control Functions ---
    function setSimulationMode(mode, modeName) {
        if (animationFrameId) {
            cancelAnimationFrame(animationFrameId);
        }
        currentWall = new IntestinalWall(mode);
        modeSpan.textContent = modeName;
        areaSpan.textContent = currentWall.getSurfaceArea();
        resetSimulation();
        gameLoop();
    }
    
    function resetSimulation() {
        glucoseMolecules = [];
        for (let i = 0; i < NUM_GLUCOSE; i++) {
            glucoseMolecules.push(new Glucose());
        }
        absorbedCount = 0;
        countSpan.textContent = absorbedCount;
    }

    // --- Quiz Logic ---
    function checkAnswers() {
        const isQ1Correct = q1Ans1.value === 'villi_micro' && q1Ans2.value === 'villi' && q1Ans3.value === 'flat';
        const isQ2Correct = q2Ans.value === 'helpful';

        q1Feedback.textContent = isQ1Correct ? '✔ 正確' : '✖ 錯誤';
        q1Feedback.className = isQ1Correct ? 'feedback-correct' : 'feedback-incorrect';
        
        q2Feedback.textContent = isQ2Correct ? '✔ 正確' : '✖ 錯誤';
        q2Feedback.className = isQ2Correct ? 'feedback-correct' : 'feedback-incorrect';
        
        if (isQ1Correct && isQ2Correct) {
            nextBtn.disabled = false;
        } else {
            nextBtn.disabled = true;
        }
    }
    
    // --- Event Listeners ---
    document.getElementById('flatBtn').addEventListener('click', () => setSimulationMode('flat', '無絨毛'));
    document.getElementById('villiBtn').addEventListener('click', () => setSimulationMode('villi', '有絨毛'));
    document.getElementById('microvilliBtn').addEventListener('click', () => setSimulationMode('villi_micro', '絨毛+微絨毛'));
    document.getElementById('resetBtn').addEventListener('click', resetSimulation);

    [q1Ans1, q1Ans2, q1Ans3, q2Ans].forEach(el => el.addEventListener('change', checkAnswers));

    document.getElementById('prevBtn').addEventListener('click', () => alert('這是上一頁'));
    document.getElementById('homeBtn').addEventListener('click', () => alert('這是回到首頁'));
    document.getElementById('nextBtn').addEventListener('click', () => alert('恭喜你，即將前往下一頁！'));

    // --- Initial Load ---
    setSimulationMode('flat', '無絨毛');
});
