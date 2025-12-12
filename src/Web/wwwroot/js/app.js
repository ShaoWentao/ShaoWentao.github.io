window.drawPolarCurve = (dataValues) => {
    const canvas = document.getElementById('iesCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;
    const centerX = width / 2;
    const centerY = height / 2;
    const radius = Math.min(centerX, centerY) - 20;

    // 1. 清空画布 (关键！这保证了透明背景)
    ctx.clearRect(0, 0, width, height);

    // 2. 绘制极坐标网格 (灰色)
    ctx.strokeStyle = '#e0e0e0';
    ctx.lineWidth = 1;
    ctx.beginPath();
    // 画几个同心圆
    for (let r = 0.2; r <= 1; r += 0.2) {
        ctx.arc(centerX, centerY, radius * r, 0, 2 * Math.PI);
    }
    ctx.stroke();

    // 画放射线 (角度线)
    ctx.beginPath();
    for (let angle = 0; angle < 360; angle += 30) {
        const rad = (angle * Math.PI) / 180;
        ctx.moveTo(centerX, centerY);
        ctx.lineTo(centerX + radius * Math.cos(rad), centerY + radius * Math.sin(rad));
    }
    ctx.stroke();

    // 3. 绘制配光曲线 (红色)
    // 注意：这里只是一个简化的模拟绘制逻辑
    // 真实的 IES 绘制需要将 (水平角, 垂直角) 映射到 (x, y)
    ctx.strokeStyle = '#ff0000'; // 红色线条
    ctx.lineWidth = 3;
    ctx.beginPath();

    // 假设 dataValues 是从 0度到 180度 的光强值
    // 这里的逻辑需要根据你 Core 层解析出的真实结构来写
    if (dataValues && dataValues.length > 0) {
        // 找到最大值用于归一化
        const maxVal = Math.max(...dataValues);
        
        for (let i = 0; i < dataValues.length; i++) {
            // 简单演示：假设数组索引对应角度 steps
            const angleDeg = i * (180 / (dataValues.length - 1)) - 90; // 调整起始角度
            const angleRad = (angleDeg * Math.PI) / 180;
            
            const r = (dataValues[i] / maxVal) * radius; // 归一化半径
            
            const x = centerX + r * Math.cos(angleRad);
            const y = centerY + r * Math.sin(angleRad); // 根据坐标系可能需要反转 Y

            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        }
    }
    
    // 闭合曲线或结束
    ctx.stroke();
};

// 下载透明图片功能
window.downloadCanvasImage = (filename) => {
    const canvas = document.getElementById('iesCanvas');
    const link = document.createElement('a');
    link.download = filename;
    link.href = canvas.toDataURL('image/png'); // 默认为透明背景的 PNG
    link.click();
};
