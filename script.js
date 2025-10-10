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

    // --- Wall Parameters (褶皺數更多的版本) ---
    // [Amplitude, Frequency]
    const PLICAE_PARAMS = [140, 0.1];
    const VILLI_PARAMS = [25, 2.0];
    const MICROVILLI_PARAMS = [7, 0.1];

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
                    if (Math.hypot(glucose.x - p1.x, glucose.y -
