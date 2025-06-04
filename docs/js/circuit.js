class Circuit {
    constructor() {
        this.canvas = document.getElementById('circuitCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.components = [];
        this.wires = [];
        this.selectedComponent = null;
        this.dragging = false;
        this.wireStart = null;
        this.selectedWire = null;

        this.initializeCanvas();
        this.setupEventListeners();
        this.setupKeyboardEvents();
        this.setupTrashZone();

        // 在本地存储中读取电路状态
        this.loadCircuitState();
        
        // 定期保存电路状态
        setInterval(() => this.saveCircuitState(), 5000);
    }

    initializeCanvas() {
        const resizeCanvas = () => {
            const container = this.canvas.parentElement;
            this.canvas.width = container.clientWidth;
            this.canvas.height = container.clientHeight;
            this.draw(); // 重绘以保持状态
        };

        window.addEventListener('resize', resizeCanvas);
        resizeCanvas();
    }

    setupEventListeners() {
        // 组件拖拽
        const gateItems = document.querySelectorAll('.gate-item');
        gateItems.forEach(item => {
            item.addEventListener('dragstart', (e) => {
                e.dataTransfer.setData('type', item.dataset.type);
            });
        });

        // 画布事件
        this.canvas.addEventListener('dragover', (e) => {
            e.preventDefault();
        });

        this.canvas.addEventListener('drop', (e) => {
            e.preventDefault();
            const type = e.dataTransfer.getData('type');
            const rect = this.canvas.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            
            this.addComponent(type, x, y);
        });

        this.canvas.addEventListener('mousedown', (e) => {
            const rect = this.canvas.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            
            this.handleMouseDown(x, y);
        });

        this.canvas.addEventListener('mousemove', (e) => {
            const rect = this.canvas.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            
            this.handleMouseMove(x, y);
        });

        this.canvas.addEventListener('mouseup', () => {
            this.handleMouseUp();
        });
    }

    // ... 保持其他现有方法不变 ...

    // 新增：保存电路状态到本地存储
    saveCircuitState() {
        const state = {
            components: this.components,
            wires: this.wires
        };
        localStorage.setItem('circuitState', JSON.stringify(state));
    }

    // 新增：从本地存储加载电路状态
    loadCircuitState() {
        const savedState = localStorage.getItem('circuitState');
        if (savedState) {
            const state = JSON.parse(savedState);
            this.components = state.components;
            this.wires = state.wires;
            this.calculateCircuitState();
            this.draw();
        }
    }

    // 新增：清除本地存储的电路状态
    clearCircuitState() {
        localStorage.removeItem('circuitState');
        this.components = [];
        this.wires = [];
        this.draw();
    }

    // 将 emitCircuitUpdate 替换为本地状态更新
    emitCircuitUpdate() {
        this.calculateCircuitState();
        this.saveCircuitState();
        this.draw();
    }
}

// 初始化电路模拟器
document.addEventListener('DOMContentLoaded', () => {
    new Circuit();
});
