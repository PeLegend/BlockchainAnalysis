const fs = require('fs');

function replaceDarkWithLight(filePath) {
    let content = fs.readFileSync(filePath, 'utf8');

    // Backgrounds
    content = content.replace(/bg-\[\#[0-9a-fA-F]{6,8}\](?:\/\d+)?/g, 'bg-white');
    content = content.replace(/bg-gray-900/g, 'bg-white');
    content = content.replace(/bg-slate-800/g, 'bg-slate-100');
    content = content.replace(/bg-gray-800/g, 'bg-gray-50');
    content = content.replace(/bg-gray-700/g, 'bg-gray-100');
    content = content.replace(/bg-black/g, 'bg-white');
    content = content.replace(/bg-blue-900/g, 'bg-blue-100');
    content = content.replace(/bg-purple-900/g, 'bg-purple-100');
    content = content.replace(/bg-red-900/g, 'bg-red-100');
    content = content.replace(/bg-green-900/g, 'bg-green-100');
    
    // ForceGraph background
    content = content.replace(/backgroundColor="#[0-9a-fA-F]{6}"/g, 'backgroundColor="#f8fafc"');

    // Texts
    content = content.replace(/text-white/g, 'text-gray-900');
    content = content.replace(/text-gray-100/g, 'text-gray-900');
    content = content.replace(/text-gray-300/g, 'text-gray-700');
    content = content.replace(/text-gray-400/g, 'text-gray-600');
    content = content.replace(/text-blue-100/g, 'text-blue-900');
    content = content.replace(/text-red-100/g, 'text-red-900');
    content = content.replace(/text-green-100/g, 'text-green-900');

    // Borders
    content = content.replace(/border-gray-800/g, 'border-gray-200');
    content = content.replace(/border-gray-700/g, 'border-gray-300');
    content = content.replace(/border-white\/5/g, 'border-black/5');
    content = content.replace(/border-white\/10/g, 'border-black/10');
    content = content.replace(/border-transparent/g, 'border-gray-200');

    // Canvas FillStyles in graph/page.tsx
    content = content.replace(/fillStyle = 'rgba\(255, 255, 255, 0\.9\)'/g, "fillStyle = 'rgba(0, 0, 0, 0.9)'");
    content = content.replace(/fillStyle = 'rgba\(255, 255, 255, 0\.95\)'/g, "fillStyle = 'rgba(0, 0, 0, 0.95)'");
    content = content.replace(/fillStyle = 'rgba\(5, 5, 16, 0\.9\)'/g, "fillStyle = 'rgba(255, 255, 255, 0.9)'");
    content = content.replace(/ctx\.strokeStyle = '#fff'/g, "ctx.strokeStyle = '#000'");
    content = content.replace(/ctx\.fillStyle = 'rgba\(255/g, "ctx.fillStyle = 'rgba(0");

    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`Replaced dark classes in ${filePath}`);
}

replaceDarkWithLight('app/page.tsx');
replaceDarkWithLight('app/graph/page.tsx');
