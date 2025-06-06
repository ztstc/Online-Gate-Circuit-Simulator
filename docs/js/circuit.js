class Circuit {
    constructor() {
        this.canvas = document.getElementById('circuitCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.components = [];
        this.wires = [];
        this.selectedComponent = null;
        this.dragging = false;
        this.dragTarget = null;
        this.dragOffsetX = 0;
        this.dragOffsetY = 0;
        this.wireStart = null;
        this.selectedWire = null;
        this.tempWireEnd = null;

        this.initializeCanvas();
        this.setupEventListeners();
        this.setupKeyboardEvents();
        this.setupTrashZone();
        this.draw();
    }

    initializeCanvas() {
        const resizeCanvas = () => {
            const container = this.canvas.parentElement;
            this.canvas.width = container.clientWidth;
            this.canvas.height = container.clientHeight;
        };

        window.addEventListener('resize', resizeCanvas);
        resizeCanvas();
    }

    setupEventListeners() {
        // 组件拖拽
        const gateItems = document.querySelectorAll('.gate-item');
        gateItems.forEach(item => {
            item.addEventListener('dragstart', (e) => {
                // 记录初始位置，用于计算放置位置
                const rect = e.target.getBoundingClientRect();
                this.dragStartX = e.clientX - rect.left;
                this.dragStartY = e.clientY - rect.top;
                
                // 设置拖拽数据和效果
                e.dataTransfer.setData('text/plain', item.dataset.type);
                e.dataTransfer.effectAllowed = 'copy';
            });
        });

        // 画布拖拽事件
        this.canvas.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'copy';
        });

        this.canvas.addEventListener('drop', (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            const type = e.dataTransfer.getData('text/plain');
            if (!type) return; // 如果没有有效的类型数据，直接返回
            
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

    setupKeyboardEvents() {
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Delete' || e.key === 'Backspace') {
                if (this.selectedComponent) {
                    this.deleteComponent(this.selectedComponent);
                }
                if (this.selectedWire) {
                    this.deleteWire(this.selectedWire);
                }
            }
        });
    }

    setupTrashZone() {
        const trashZone = document.getElementById('trashZone');

        this.canvas.addEventListener('dragstart', (e) => {
            if (this.selectedComponent) {
                trashZone.classList.add('active');
                // 阻止画布默认拖拽行为
                e.stopPropagation();
            }
        });

        this.canvas.addEventListener('dragend', () => {
            trashZone.classList.remove('active');
        });

        trashZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
        });

        trashZone.addEventListener('drop', (e) => {
            e.preventDefault();
            if (this.selectedComponent) {
                const component = this.selectedComponent;
                
                // 创建删除动画
                this.createDeleteAnimation(component);

                // 延迟删除组件
                setTimeout(() => {
                    this.deleteComponent(component);
                    trashZone.classList.remove('active');
                }, 300);
            }
        });
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
        this.calculateCircuitState();
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

        // 检查是否点击了线
        this.selectedWire = this.findWireAt(x, y);
        if (this.selectedWire) {
            this.selectedComponent = null;
            return;
        }

        const component = this.findComponentAt(x, y);
        if (component) {
            this.dragTarget = component;
            this.dragOffsetX = x - component.x;
            this.dragOffsetY = y - component.y;
            
            if (component.type === 'INPUT') {
                const dx = x - component.x;
                const dy = y - component.y;
                const distanceFromCenter = Math.sqrt(dx * dx + dy * dy);
                
                if (distanceFromCenter <= 10) {  // 如果点击在中心区域
                    component.state = !component.state;
                    this.calculateCircuitState();
                    this.draw();
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

    connectWire(endPort) {
        if (this.wireStart && endPort) {
            // 检查是否试图连接同一个组件的端口
            if (this.wireStart.component === endPort.component) {
                this.showError('不能连接同一个组件的端口');
                return;
            }
            
            // 检查输入端口是否已经有连接
            const hasExistingConnection = this.wires.some(wire => 
                wire.end.component === endPort.component && 
                wire.end.inputIndex === endPort.index
            );
            
            if (hasExistingConnection) {
                this.showError('该输入端口已经有连接');
                return;
            }
            
            // 检查连接方向（输出连输入）
            if (this.wireStart.type === 'output' && endPort.type === 'input') {
                this.createWire(this.wireStart, endPort);
            } else if (this.wireStart.type === 'input' && endPort.type === 'output') {
                this.createWire(endPort, this.wireStart);
            } else {
                this.showError('连接无效：输出端口只能连接到输入端口');
                return;
            }
            
            this.calculateCircuitState();
            this.draw();
        }
        this.wireStart = null;
        this.tempWireEnd = null;
    }

    createWire(startPort, endPort) {
        this.wires.push({
            start: {
                component: startPort.component,
                x: startPort.x,
                y: startPort.y
            },
            end: {
                component: endPort.component,
                x: endPort.x,
                y: endPort.y,
                inputIndex: endPort.index
            }
        });
    }

    showError(message) {
        // 创建错误提示元素
        const errorDiv = document.createElement('div');
        errorDiv.style.position = 'fixed';
        errorDiv.style.top = '20px';
        errorDiv.style.left = '50%';
        errorDiv.style.transform = 'translateX(-50%)';
        errorDiv.style.backgroundColor = '#ff4444';
        errorDiv.style.color = 'white';
        errorDiv.style.padding = '10px 20px';
        errorDiv.style.borderRadius = '4px';
        errorDiv.style.zIndex = '1000';
        errorDiv.textContent = message;
        
        document.body.appendChild(errorDiv);
        
        // 2秒后移除提示
        setTimeout(() => {
            errorDiv.style.opacity = '0';
            errorDiv.style.transition = 'opacity 0.5s ease';
            setTimeout(() => document.body.removeChild(errorDiv), 500);
        }, 2000);
    }

    findComponentAt(x, y) {
        return this.components.find(component => {
            const dx = x - component.x;
            const dy = y - component.y;
            return (dx * dx + dy * dy) < 400; // 20px radius
        });
    }    findPortAt(x, y) {
        for (const component of this.components) {
            // 检查输入端口
            if (component.type !== 'INPUT') { // 输入组件没有输入端口
                if (component.type === 'NOT') {
                    // 非门只有一个输入端口
                    const portX = component.x - 25;
                    const portY = component.y;
                    if (Math.hypot(x - portX, y - portY) < 5) {
                        return { component, type: 'input', index: 0, x: portX, y: portY };
                    }
                } else if (component.type === 'AND' || component.type === 'OR') {
                    // 与门和或门有两个输入端口
                    const portX = component.x - 25;
                    // 上方输入端口
                    if (Math.hypot(x - portX, y - (component.y - 15)) < 5) {
                        return { component, type: 'input', index: 0, x: portX, y: component.y - 15 };
                    }
                    // 下方输入端口
                    if (Math.hypot(x - portX, y - (component.y + 15)) < 5) {
                        return { component, type: 'input', index: 1, x: portX, y: component.y + 15 };
                    }
                } else if (component.type === 'OUTPUT') {
                    // 输出节点只有一个输入端口
                    const portX = component.x - 19;
                    const portY = component.y;
                    if (Math.hypot(x - portX, y - portY) < 5) {
                        return { component, type: 'input', index: 0, x: portX, y: portY };
                    }
                }
            }

            // 检查输出端口
            if (component.type !== 'OUTPUT') { // 输出组件没有输出端口
                const outPortX = component.x + 25;
                const outPortY = component.y;
                if (Math.hypot(x - outPortX, y - outPortY) < 5) {
                    return { component, type: 'output', x: outPortX, y: outPortY };
                }
            }
        }
        return null;
    }

    findWireAt(x, y) {
        return this.wires.find(wire => {
            const dx = wire.end.x - wire.start.x;
            const dy = wire.end.y - wire.start.y;
            const length = Math.sqrt(dx * dx + dy * dy);
            
            // 计算点到线段的距离
            const dot = ((x - wire.start.x) * dx + (y - wire.start.y) * dy) / (length * length);
            if (dot < 0 || dot > 1) return false;
            
            const closestX = wire.start.x + dot * dx;
            const closestY = wire.start.y + dot * dy;
            const distance = Math.hypot(x - closestX, y - closestY);
            
            return distance < 5;
        });
    }

    startDragging(component, x, y) {
        // 清理可能存在的旧虚影
        const oldGhost = document.getElementById('dragGhost');
        if (oldGhost) {
            oldGhost.remove();
        }

        this.dragging = true;
        this.selectedComponent = component;
        this.dragOffsetX = x - component.x;
        this.dragOffsetY = y - component.y;
    }

    handleMouseMove(x, y) {
        if (this.dragging && this.selectedComponent) {
            const newX = x - this.dragOffsetX;
            const newY = y - this.dragOffsetY;
            
            // 更新组件位置
            this.selectedComponent.x = newX;
            this.selectedComponent.y = newY;
            
            // 更新连线位置
            this.wires.forEach(wire => {
                if (wire.start.component === this.selectedComponent) {
                    if (wire.start.component.type === 'INPUT') {
                        wire.start.x = newX + 19;
                        wire.start.y = newY;
                    } else {
                        wire.start.x = newX + 25;
                        wire.start.y = newY;
                    }
                }
                if (wire.end.component === this.selectedComponent) {
                    if (wire.end.component.type === 'OUTPUT') {
                        wire.end.x = newX - 19;
                        wire.end.y = newY;
                    } else if (wire.end.component.type === 'NOT') {
                        wire.end.x = newX - 25;
                        wire.end.y = newY;
                    } else {
                        wire.end.x = newX - 25;
                        wire.end.y = newY + (wire.end.inputIndex === 0 ? -15 : 15);
                    }
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

        this.dragging = false;
        this.selectedComponent = null;
        this.tempWireEnd = null;
    }

    draw() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        // 绘制连线
        this.wires.forEach(wire => {
            this.drawWire(wire);
        });

        // 绘制临时连线
        if (this.wireStart && this.tempWireEnd) {
            this.ctx.beginPath();
            this.ctx.moveTo(this.wireStart.x, this.wireStart.y);
            this.ctx.lineTo(this.tempWireEnd.x, this.tempWireEnd.y);
            this.ctx.setLineDash([5, 3]); // 设置虚线样式
            this.ctx.strokeStyle = '#666';
            this.ctx.stroke();
            this.ctx.setLineDash([]); // 恢复实线
            this.ctx.strokeStyle = '#000';
        }
        
        // 绘制组件
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
        this.ctx.stroke();
    }    drawANDGate(component) {
        const x = component.x;
        const y = component.y;
        
        // 绘制正方形主体
        this.ctx.beginPath();
        this.ctx.rect(x - 20, y - 20, 40, 40);
        this.ctx.stroke();

        // 绘制 & 符号
        this.ctx.fillStyle = '#000000';
        this.ctx.font = '24px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillText('&', x, y);

        // 绘制输入接口
        this.ctx.beginPath();
        this.ctx.arc(x - 25, y - 15, 4, 0, Math.PI * 2); // 输入1
        this.ctx.arc(x - 25, y + 15, 4, 0, Math.PI * 2); // 输入2
        this.ctx.fillStyle = '#4CAF50';
        this.ctx.fill();
        this.ctx.stroke();

        // 绘制输出接口
        this.ctx.beginPath();
        this.ctx.arc(x + 25, y, 4, 0, Math.PI * 2);
        this.ctx.fillStyle = '#f44336';
        this.ctx.fill();
        this.ctx.stroke();
    }

    drawORGate(component) {
        const x = component.x;
        const y = component.y;
        
        // 绘制正方形主体
        this.ctx.beginPath();
        this.ctx.rect(x - 20, y - 20, 40, 40);
        this.ctx.stroke();

        // 绘制 >=1 符号
        this.ctx.fillStyle = '#000000';
        this.ctx.font = '16px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillText('≥1', x, y);

        // 绘制输入接口
        this.ctx.beginPath();
        this.ctx.arc(x - 25, y - 15, 4, 0, Math.PI * 2); // 输入1
        this.ctx.arc(x - 25, y + 15, 4, 0, Math.PI * 2); // 输入2
        this.ctx.fillStyle = '#4CAF50';
        this.ctx.fill();
        this.ctx.stroke();

        // 绘制输出接口
        this.ctx.beginPath();
        this.ctx.arc(x + 25, y, 4, 0, Math.PI * 2);
        this.ctx.fillStyle = '#f44336';
        this.ctx.fill();
        this.ctx.stroke();
    }

    drawNOTGate(component) {
        const x = component.x;
        const y = component.y;
        
        // 绘制正方形主体
        this.ctx.beginPath();
        this.ctx.rect(x - 20, y - 20, 40, 40);
        this.ctx.stroke();

        // 绘制 1 符号
        this.ctx.fillStyle = '#000000';
        this.ctx.font = '24px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillText('1', x, y);

        // 绘制输入接口
        this.ctx.beginPath();
        this.ctx.arc(x - 25, y, 4, 0, Math.PI * 2);
        this.ctx.fillStyle = '#4CAF50';
        this.ctx.fill();
        this.ctx.stroke();

        // 绘制输出圆圈和接口
        this.ctx.beginPath();
        this.ctx.arc(x + 25, y, 8, 0, Math.PI * 2); // 空心圆
        this.ctx.stroke();
        this.ctx.beginPath();
        this.ctx.arc(x + 25, y, 4, 0, Math.PI * 2); // 接口点
        this.ctx.fillStyle = '#f44336';
        this.ctx.fill();
        this.ctx.stroke();
    }

    drawIO(component) {
        const x = component.x;
        const y = component.y;
        
        // 绘制主体
        this.ctx.beginPath();
        this.ctx.arc(x, y, 15, 0, Math.PI * 2);
        this.ctx.fillStyle = component.state ? '#4CAF50' : '#f44336';
        this.ctx.fill();
        this.ctx.stroke();

        // 绘制接口点
        this.ctx.beginPath();
        if (component.type === 'INPUT') {
            // 输入节点只有输出接口
            this.ctx.arc(x + 19, y, 4, 0, Math.PI * 2);
            this.ctx.fillStyle = '#f44336';
        } else {
            // 输出节点只有输入接口
            this.ctx.arc(x - 19, y, 4, 0, Math.PI * 2);
            this.ctx.fillStyle = '#4CAF50';
        }
        this.ctx.fill();
        this.ctx.stroke();

        // 绘制标签
        this.ctx.fillStyle = '#ffffff';
        this.ctx.font = '12px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillText(component.type === 'INPUT' ? 'IN' : 'OUT', x, y);
    }    drawWire(wire) {
        this.ctx.beginPath();
        
        // 如果连线被选中，使用不同的样式
        if (wire === this.selectedWire) {
            this.ctx.strokeStyle = '#0066cc';
            this.ctx.lineWidth = 2;
        } else {
            // 根据起点组件的状态决定连线颜色
            const state = wire.start.component.state;
            this.ctx.strokeStyle = state ? '#4CAF50' : '#f44336';
            this.ctx.lineWidth = 1;
        }
        
        // 创建贝塞尔曲线点
        const dx = wire.end.x - wire.start.x;
        const controlPoint1X = wire.start.x + dx * 0.5;
        const controlPoint2X = wire.end.x - dx * 0.5;
        
        // 绘制贝塞尔曲线
        this.ctx.moveTo(wire.start.x, wire.start.y);
        this.ctx.bezierCurveTo(
            controlPoint1X, wire.start.y,
            controlPoint2X, wire.end.y,
            wire.end.x, wire.end.y
        );
        
        this.ctx.stroke();
        this.ctx.strokeStyle = '#000000';  // 恢复默认颜色
        this.ctx.lineWidth = 1;  // 恢复默认线宽
    }

    calculateCircuitState() {
        // 重置所有非输入组件的状态
        this.components.forEach(component => {
            if (component.type !== 'INPUT') {
                component.state = null;
            }
        });

        // 拓扑排序计算
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

        // 获取连接到该组件的所有输入线
        const inputs = [];
        let connectedWires = 0;
        
        this.wires.forEach(wire => {
            if (wire.end.component === component) {
                connectedWires++;
                const sourceComponent = wire.start.component;
                inputs[wire.end.inputIndex] = sourceComponent.state;
            }
        });
        
        // 根据组件类型计算输出
        let result = null;
        switch (component.type) {
            case 'AND':
                result = inputs.length === 2 && inputs[0] !== null && inputs[1] !== null ? 
                       (inputs[0] && inputs[1]) : null;
                break;
                
            case 'OR':
                result = inputs.length === 2 && inputs[0] !== null && inputs[1] !== null ? 
                       (inputs[0] || inputs[1]) : null;
                break;
                
            case 'NOT':
                result = inputs.length === 1 && inputs[0] !== null ? 
                       !inputs[0] : null;
                break;
                
            case 'OUTPUT':
                result = inputs.length === 1 && inputs[0] !== null ? 
                       inputs[0] : null;
                break;
                
            default:
                result = null;
        }

        return result;
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
        this.calculateCircuitState();
    }

    deleteComponent(component) {
        // 删除与该组件相关的所有连线
        this.wires = this.wires.filter(wire => 
            wire.start.component !== component && 
            wire.end.component !== component
        );
        
        // 删除组件
        const index = this.components.indexOf(component);
        if (index > -1) {
            this.components.splice(index, 1);
        }
        
        this.selectedComponent = null;
        this.draw();
        this.calculateCircuitState();
    }

    deleteWire(wire) {
        const index = this.wires.indexOf(wire);
        if (index > -1) {
            this.wires.splice(index, 1);
        }
        this.selectedWire = null;
        this.draw();
        this.calculateCircuitState();
    }
}

// 初始化电路模拟器
document.addEventListener('DOMContentLoaded', () => {
    new Circuit();
});
