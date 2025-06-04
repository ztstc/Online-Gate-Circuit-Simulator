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
    }

    initializeCanvas() {
        const resizeCanvas = () => {
            const container = this.canvas.parentElement;
            this.canvas.width = container.clientWidth;
            this.canvas.height = container.clientHeight;
            this.draw(); // 确保在调整大小后重绘
        };

        window.addEventListener('resize', resizeCanvas);
        resizeCanvas();
    }

    setupEventListeners() {
        // 组件拖拽
        const gateItems = document.querySelectorAll('.gate-item');
        gateItems.forEach(item => {
            item.addEventListener('dragstart', (e) => {
                e.dataTransfer.setData('text/plain', item.dataset.type);
                e.dataTransfer.effectAllowed = 'copy';
            });
        });

        // 画布事件
        this.canvas.addEventListener('dragenter', (e) => {
            e.preventDefault();
            this.canvas.style.backgroundColor = '#f0f0f0';
        });

        this.canvas.addEventListener('dragleave', (e) => {
            e.preventDefault();
            this.canvas.style.backgroundColor = '#ffffff';
        });

        this.canvas.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'copy';
        });

        this.canvas.addEventListener('drop', (e) => {
            e.preventDefault();
            this.canvas.style.backgroundColor = '#ffffff';
            const type = e.dataTransfer.getData('text/plain');
            
            if (type) {
                const rect = this.canvas.getBoundingClientRect();
                const x = e.clientX - rect.left;
                const y = e.clientY - rect.top;
                this.addComponent(type, x, y);
            }
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

    setupKeyboardEvents() {
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Delete' || e.key === 'Backspace') {
                if (this.selectedComponent) {
                    this.deleteComponent(this.selectedComponent);
                }
                if (this.selectedWire) {
                    this.deleteWire(this.selectedWire);
                }
            } else if (e.key === 'Escape') {
                this.cleanupDragging();
            }
        });
    }

    setupTrashZone() {
        const trashZone = document.getElementById('trashZone');

        trashZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            trashZone.classList.add('active');
        });

        trashZone.addEventListener('dragleave', (e) => {
            e.preventDefault();
            trashZone.classList.remove('active');
        });

        trashZone.addEventListener('drop', (e) => {
            e.preventDefault();
            if (this.selectedComponent) {
                const component = this.selectedComponent;
                this.createDeleteAnimation(component);
                setTimeout(() => {
                    this.deleteComponent(component);
                }, 300);
            }
            this.cleanupDragging();
            trashZone.classList.remove('active');
        });
    }

    cleanupDragging() {
        const dragGhost = document.getElementById('dragGhost');
        if (dragGhost && dragGhost.parentNode) {
            dragGhost.parentNode.removeChild(dragGhost);
        }
        
        // 清理拖拽状态
        if (this.selectedComponent) {
            this.draw(); // 重新绘制以确保组件位置正确
        }
        
        // 重置内部状态
        this.dragging = false;
        this.selectedComponent = null;
        
        // 清理垃圾桶区域的激活状态
        const trashZone = document.getElementById('trashZone');
        if (trashZone) {
            trashZone.classList.remove('active');
        }
    }

    createDeleteAnimation(component) {
        const rect = this.canvas.getBoundingClientRect();
        const x = component.x + rect.left;
        const y = component.y + rect.top;
        
        const ghost = document.createElement('div');
        ghost.style.position = 'fixed';
        ghost.style.left = x + 'px';
        ghost.style.top = y + 'px';
        ghost.style.width = '40px';
        ghost.style.height = '40px';
        ghost.style.background = component.type === 'INPUT' || component.type === 'OUTPUT' 
            ? '#f44336' 
            : '#fff';
        ghost.style.border = '2px solid #000';
        ghost.style.borderRadius = component.type === 'INPUT' || component.type === 'OUTPUT'
            ? '50%'
            : '4px';
        ghost.className = 'deleting';
        document.body.appendChild(ghost);

        setTimeout(() => document.body.removeChild(ghost), 300);
    }

    addComponent(type, x, y) {
        const component = {
            type,
            x,
            y,
            inputs: [],
            outputs: [],
            state: type === 'INPUT' ? false : null
        };

        this.components.push(component);
        this.draw();
    }

    handleMouseDown(x, y) {
        const port = this.findPortAt(x, y);
        if (port) {
            if (this.wireStart) {
                this.connectWire(port);
            } else {
                this.wireStart = port;
            }
            return;
        }

        this.selectedWire = this.findWireAt(x, y);
        if (this.selectedWire) {
            this.selectedComponent = null;
            return;
        }

        const component = this.findComponentAt(x, y);
        if (component) {
            if (component.type === 'INPUT') {
                const dx = x - component.x;
                const dy = y - component.y;
                const distanceFromCenter = Math.sqrt(dx * dx + dy * dy);
                
                if (distanceFromCenter <= 10) {
                    component.state = !component.state;
                    this.calculateCircuitState();
                    this.draw();
                } else {
                    this.selectedComponent = component;
                    this.dragging = true;
                    this.startDragging(component, x, y);
                }
            } else {
                this.selectedComponent = component;
                this.dragging = true;
                this.startDragging(component, x, y);
            }
            this.selectedWire = null;
        } else {
            this.selectedComponent = null;
            this.selectedWire = null;
        }
    }

    startDragging(component, x, y) {
        // 首先清理可能存在的旧虚影
        this.cleanupDragging();

        // 创建一个可视化的拖拽元素
        const dragElement = document.createElement('div');
        dragElement.id = 'dragGhost';
        dragElement.style.position = 'fixed';
        dragElement.style.width = '40px';
        dragElement.style.height = '40px';
        dragElement.style.pointerEvents = 'none';
        dragElement.style.zIndex = '1000';
        
        if (component.type === 'INPUT' || component.type === 'OUTPUT') {
            dragElement.style.borderRadius = '50%';
            dragElement.style.backgroundColor = component.state ? '#4CAF50' : '#f44336';
        } else {
            dragElement.style.border = '2px solid black';
            dragElement.style.backgroundColor = 'white';
            dragElement.style.display = 'flex';
            dragElement.style.alignItems = 'center';
            dragElement.style.justifyContent = 'center';
            dragElement.innerText = component.type === 'AND' ? '&' : 
                                  component.type === 'OR' ? '≥1' : '1';
        }        document.body.appendChild(dragElement);

        const updateDragPosition = (e) => {
            const rect = this.canvas.getBoundingClientRect();
            const canvasX = e.clientX - rect.left;
            const canvasY = e.clientY - rect.top;
            
            // 更新虚影位置
            dragElement.style.left = e.clientX - 20 + 'px';
            dragElement.style.top = e.clientY - 20 + 'px';

            // 更新实际组件位置
            if (this.selectedComponent) {
                const dx = canvasX - this.selectedComponent.x;
                const dy = canvasY - this.selectedComponent.y;
                
                this.selectedComponent.x = canvasX;
                this.selectedComponent.y = canvasY;
                
                // 更新与该组件相关的所有线的位置
                this.wires.forEach(wire => {
                    if (wire.start.component === this.selectedComponent) {
                        wire.start.x += dx;
                        wire.start.y += dy;
                    }
                    if (wire.end.component === this.selectedComponent) {
                        wire.end.x += dx;
                        wire.end.y += dy;
                    }
                });
                
                this.draw(); // 确保实时更新组件位置
            }
        };

        const handleDragMove = (e) => {
            updateDragPosition(e);
            const trashZone = document.getElementById('trashZone');
            const trashRect = trashZone.getBoundingClientRect();
            
            if (e.clientX >= trashRect.left && e.clientX <= trashRect.right &&
                e.clientY >= trashRect.top && e.clientY <= trashRect.bottom) {
                trashZone.classList.add('active');
            } else {
                trashZone.classList.remove('active');
            }
        };

        const handleDragEnd = (e) => {
            const trashZone = document.getElementById('trashZone');
            const trashRect = trashZone.getBoundingClientRect();
            
            if (e.clientX >= trashRect.left && e.clientX <= trashRect.right &&
                e.clientY >= trashRect.top && e.clientY <= trashRect.bottom) {
                this.createDeleteAnimation(component);
                setTimeout(() => {
                    this.deleteComponent(component);
                }, 300);
            }
            
            this.cleanupDragging();
        };

        document.addEventListener('mousemove', handleDragMove);
        document.addEventListener('mouseup', handleDragEnd);
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.cleanupDragging();
            }
        });

        updateDragPosition({ clientX: x, clientY: y });
        this.canvas.style.cursor = 'grabbing';
    }

    handleMouseMove(x, y) {
        if (this.dragging && this.selectedComponent) {
            const dx = x - this.selectedComponent.x;
            const dy = y - this.selectedComponent.y;
            
            this.selectedComponent.x = x;
            this.selectedComponent.y = y;
            
            // 更新与该组件相关的所有线的位置
            this.wires.forEach(wire => {
                if (wire.start.component === this.selectedComponent) {
                    wire.start.x += dx;
                    wire.start.y += dy;
                }
                if (wire.end.component === this.selectedComponent) {
                    wire.end.x += dx;
                    wire.end.y += dy;
                }
            });
            
            this.draw();
        } else if (this.wireStart) {
            this.tempWireEnd = { x, y };
            this.draw();
            
            const port = this.findPortAt(x, y);
            this.canvas.style.cursor = port ? 'pointer' : 'crosshair';
        } else {
            const port = this.findPortAt(x, y);
            const wire = this.findWireAt(x, y);
            this.canvas.style.cursor = port || wire ? 'pointer' : 'default';
        }
    }

    handleMouseUp() {
        if (this.wireStart && this.tempWireEnd) {
            const endPort = this.findPortAt(this.tempWireEnd.x, this.tempWireEnd.y);
            this.connectWire(endPort);
        }
        this.cleanupDragging();
    }

    // ... 其余方法保持不变 ...

    calculateCircuitState() {
        this.components.forEach(component => {
            if (component.type !== 'INPUT') {
                component.state = null;
            }
        });

        const processed = new Set();
        const stack = [...this.components.filter(c => c.type === 'INPUT')];
        
        while (stack.length > 0) {
            const current = stack.pop();
            if (processed.has(current)) continue;
            
            const outputs = this.wires
                .filter(w => w.start.component === current)
                .map(w => w.end.component);
                
            for (const output of outputs) {
                const state = this.calculateComponentState(output);
                if (state !== null) {
                    output.state = state;
                    stack.push(output);
                }
            }
            
            processed.add(current);
        }
    }

    calculateComponentState(component) {
        if (component.type === 'INPUT') {
            return component.state;
        }

        const inputs = [];
        this.wires.forEach(wire => {
            if (wire.end.component === component) {
                inputs[wire.end.inputIndex] = wire.start.component.state;
            }
        });
        
        switch (component.type) {
            case 'AND':
                return inputs.length === 2 && inputs[0] !== null && inputs[1] !== null ? 
                       (inputs[0] && inputs[1]) : null;
            case 'OR':
                return inputs.length === 2 && inputs[0] !== null && inputs[1] !== null ? 
                       (inputs[0] || inputs[1]) : null;
            case 'NOT':
                return inputs.length === 1 && inputs[0] !== null ? 
                       !inputs[0] : null;
            case 'OUTPUT':
                return inputs.length === 1 && inputs[0] !== null ? 
                       inputs[0] : null;
            default:
                return null;
        }
    }

    deleteComponent(component) {
        this.wires = this.wires.filter(wire => 
            wire.start.component !== component && 
            wire.end.component !== component
        );
        
        const index = this.components.indexOf(component);
        if (index > -1) {
            this.components.splice(index, 1);
        }
        
        this.selectedComponent = null;
        this.draw();
    }

    deleteWire(wire) {
        const index = this.wires.indexOf(wire);
        if (index > -1) {
            this.wires.splice(index, 1);
        }
        this.selectedWire = null;
        this.draw();
    }

    findComponentAt(x, y) {
        return this.components.find(component => {
            const dx = x - component.x;
            const dy = y - component.y;
            return (dx * dx + dy * dy) < 400;
        });
    }

    findPortAt(x, y) {
        for (const component of this.components) {
            if (component.type !== 'INPUT') {
                if (component.type === 'NOT') {
                    const portX = component.x - 25;
                    const portY = component.y;
                    if (Math.hypot(x - portX, y - portY) < 5) {
                        return { component, type: 'input', index: 0, x: portX, y: portY };
                    }
                } else if (component.type === 'AND' || component.type === 'OR') {
                    const portX = component.x - 25;
                    if (Math.hypot(x - portX, y - (component.y - 15)) < 5) {
                        return { component, type: 'input', index: 0, x: portX, y: component.y - 15 };
                    }
                    if (Math.hypot(x - portX, y - (component.y + 15)) < 5) {
                        return { component, type: 'input', index: 1, x: portX, y: component.y + 15 };
                    }
                } else if (component.type === 'OUTPUT') {
                    const portX = component.x - 19;
                    const portY = component.y;
                    if (Math.hypot(x - portX, y - portY) < 5) {
                        return { component, type: 'input', index: 0, x: portX, y: portY };
                    }
                }
            }

            if (component.type !== 'OUTPUT') {
                const outPortX = component.x + 25;
                const outPortY = component.y;
                if (Math.hypot(x - outPortX, y - outPortY) < 5) {
                    return { component, type: 'output', x: outPortX, y: outPortY };
                }
            }
        }
        return null;
    }

    connectWire(endPort) {
        if (!this.wireStart || !endPort) {
            this.wireStart = null;
            this.tempWireEnd = null;
            this.draw();
            return;
        }

        if (this.wireStart.component === endPort.component) {
            this.wireStart = null;
            this.tempWireEnd = null;
            this.draw();
            return;
        }
        
        this.wires = this.wires.filter(wire => {
            return !(wire.end.component === endPort.component && 
                    wire.end.inputIndex === endPort.index);
        });
        
        if (this.wireStart.type === 'output' && endPort.type === 'input') {
            this.wires.push({
                start: {
                    component: this.wireStart.component,
                    x: this.wireStart.x,
                    y: this.wireStart.y
                },
                end: {
                    component: endPort.component,
                    x: endPort.x,
                    y: endPort.y,
                    inputIndex: endPort.index
                }
            });
        } else if (this.wireStart.type === 'input' && endPort.type === 'output') {
            this.wires.push({
                start: {
                    component: endPort.component,
                    x: endPort.x,
                    y: endPort.y
                },
                end: {
                    component: this.wireStart.component,
                    x: this.wireStart.x,
                    y: this.wireStart.y,
                    inputIndex: this.wireStart.index
                }
            });
        }
        
        this.wireStart = null;
        this.tempWireEnd = null;
        
        this.calculateCircuitState();
        this.draw();
    }

    draw() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        this.wires.forEach(wire => {
            this.drawWire(wire);
        });

        if (this.wireStart && this.tempWireEnd) {
            this.ctx.beginPath();
            this.ctx.moveTo(this.wireStart.x, this.wireStart.y);
            this.ctx.lineTo(this.tempWireEnd.x, this.tempWireEnd.y);
            this.ctx.setLineDash([5, 3]);
            this.ctx.strokeStyle = '#666';
            this.ctx.stroke();
            this.ctx.setLineDash([]);
            this.ctx.strokeStyle = '#000';
        }
        
        this.components.forEach(component => {
            this.drawComponent(component);
        });
    }

    drawComponent(component) {
        this.ctx.beginPath();
        switch (component.type) {
            case 'AND':
                this.drawANDGate(component);
                break;
            case 'OR':
                this.drawORGate(component);
                break;
            case 'NOT':
                this.drawNOTGate(component);
                break;
            case 'INPUT':
            case 'OUTPUT':
                this.drawIO(component);
                break;
        }
    }

    drawANDGate(component) {
        const x = component.x;
        const y = component.y;
        
        this.ctx.rect(x - 20, y - 20, 40, 40);
        this.ctx.stroke();

        this.ctx.fillStyle = '#000000';
        this.ctx.font = '24px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillText('&', x, y);

        this.ctx.beginPath();
        this.ctx.arc(x - 25, y - 15, 4, 0, Math.PI * 2);
        this.ctx.arc(x - 25, y + 15, 4, 0, Math.PI * 2);
        this.ctx.fillStyle = component.inputs[0] ? '#4CAF50' : '#f44336';
        this.ctx.fill();
        this.ctx.stroke();

        this.ctx.beginPath();
        this.ctx.arc(x + 25, y, 4, 0, Math.PI * 2);
        this.ctx.fillStyle = component.state ? '#4CAF50' : '#f44336';
        this.ctx.fill();
        this.ctx.stroke();
    }

    drawORGate(component) {
        const x = component.x;
        const y = component.y;
        
        this.ctx.rect(x - 20, y - 20, 40, 40);
        this.ctx.stroke();

        this.ctx.fillStyle = '#000000';
        this.ctx.font = '16px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillText('≥1', x, y);

        this.ctx.beginPath();
        this.ctx.arc(x - 25, y - 15, 4, 0, Math.PI * 2);
        this.ctx.arc(x - 25, y + 15, 4, 0, Math.PI * 2);
        this.ctx.fillStyle = component.inputs[0] ? '#4CAF50' : '#f44336';
        this.ctx.fill();
        this.ctx.stroke();

        this.ctx.beginPath();
        this.ctx.arc(x + 25, y, 4, 0, Math.PI * 2);
        this.ctx.fillStyle = component.state ? '#4CAF50' : '#f44336';
        this.ctx.fill();
        this.ctx.stroke();
    }

    drawNOTGate(component) {
        const x = component.x;
        const y = component.y;
        
        this.ctx.rect(x - 20, y - 20, 40, 40);
        this.ctx.stroke();

        this.ctx.fillStyle = '#000000';
        this.ctx.font = '24px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillText('1', x, y);

        this.ctx.beginPath();
        this.ctx.arc(x - 25, y, 4, 0, Math.PI * 2);
        this.ctx.fillStyle = component.inputs[0] ? '#4CAF50' : '#f44336';
        this.ctx.fill();
        this.ctx.stroke();

        this.ctx.beginPath();
        this.ctx.arc(x + 25, y, 8, 0, Math.PI * 2);
        this.ctx.stroke();
        this.ctx.beginPath();
        this.ctx.arc(x + 25, y, 4, 0, Math.PI * 2);
        this.ctx.fillStyle = component.state ? '#4CAF50' : '#f44336';
        this.ctx.fill();
        this.ctx.stroke();
    }

    drawIO(component) {
        const x = component.x;
        const y = component.y;
        
        this.ctx.beginPath();
        this.ctx.arc(x, y, 15, 0, Math.PI * 2);
        this.ctx.fillStyle = component.state ? '#4CAF50' : '#f44336';
        this.ctx.fill();
        this.ctx.stroke();

        this.ctx.beginPath();
        if (component.type === 'INPUT') {
            this.ctx.arc(x + 19, y, 4, 0, Math.PI * 2);
            this.ctx.fillStyle = component.state ? '#4CAF50' : '#f44336';
        } else {
            this.ctx.arc(x - 19, y, 4, 0, Math.PI * 2);
            this.ctx.fillStyle = component.inputs[0] ? '#4CAF50' : '#f44336';
        }
        this.ctx.fill();
        this.ctx.stroke();

        this.ctx.fillStyle = '#ffffff';
        this.ctx.font = '12px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillText(component.type === 'INPUT' ? 'IN' : 'OUT', x, y);
    }

    drawWire(wire) {
        this.ctx.beginPath();
        this.ctx.moveTo(wire.start.x, wire.start.y);
        this.ctx.lineTo(wire.end.x, wire.end.y);
        
        if (wire === this.selectedWire) {
            this.ctx.strokeStyle = '#0066cc';
            this.ctx.lineWidth = 2;
        } else {
            this.ctx.strokeStyle = '#000000';
            this.ctx.lineWidth = 1;
        }
        
        this.ctx.stroke();
        this.ctx.strokeStyle = '#000000';
        this.ctx.lineWidth = 1;
    }

    findWireAt(x, y) {
        return this.wires.find(wire => {
            const dx = wire.end.x - wire.start.x;
            const dy = wire.end.y - wire.start.y;
            const length = Math.sqrt(dx * dx + dy * dy);
            
            const dot = ((x - wire.start.x) * dx + (y - wire.start.y) * dy) / (length * length);
            if (dot < 0 || dot > 1) return false;
            
            const closestX = wire.start.x + dot * dx;
            const closestY = wire.start.y + dot * dy;
            const distance = Math.hypot(x - closestX, y - closestY);
            
            return distance < 5;
        });
    }
}

// 初始化电路模拟器
document.addEventListener('DOMContentLoaded', () => {
    new Circuit();
});
