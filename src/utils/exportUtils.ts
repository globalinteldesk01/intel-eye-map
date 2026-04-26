import { NewsItem } from '@/types/news';
import jsPDF from 'jspdf';

export function exportToCSV(items: NewsItem[], filename: string = 'intel-report') {
  const headers = [
    'ID', 'Title', 'Summary', 'Category', 'Threat Level', 'Confidence',
    'Country', 'Region', 'Source', 'Source Credibility', 'Published At', 'Tags'
  ];

  const rows = items.map(item => [
    item.id,
    `"${item.title.replace(/"/g, '""')}"`,
    `"${item.summary.replace(/"/g, '""')}"`,
    item.category,
    item.threatLevel,
    item.confidenceLevel,
    item.country,
    item.region,
    item.source,
    item.sourceCredibility,
    item.publishedAt,
    `"${item.tags.join(', ')}"`,
  ]);

  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.join(','))
  ].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `${filename}-${new Date().toISOString().split('T')[0]}.csv`;
  link.click();
}

export function exportToPDF(items: NewsItem[], filename: string = 'intel-report') {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  
  // Title
  doc.setFontSize(18);
  doc.setTextColor(20, 184, 166); // Teal
  doc.text('Intelligence Report', pageWidth / 2, 20, { align: 'center' });
  
  // Subtitle
  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text(`Generated: ${new Date().toLocaleString()}`, pageWidth / 2, 28, { align: 'center' });
  doc.text(`Total Items: ${items.length}`, pageWidth / 2, 34, { align: 'center' });

  // Summary stats
  const threatCounts = items.reduce((acc, item) => {
    acc[item.threatLevel] = (acc[item.threatLevel] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  doc.setFontSize(12);
  doc.setTextColor(40);
  doc.text('Threat Summary:', 20, 48);
  
  doc.setFontSize(10);
  let yPos = 56;
  Object.entries(threatCounts).forEach(([level, count]) => {
    doc.text(`• ${level.toUpperCase()}: ${count} items`, 25, yPos);
    yPos += 6;
  });

  // Items
  yPos += 10;
  doc.setFontSize(12);
  doc.text('Intelligence Items:', 20, yPos);
  yPos += 8;

  items.slice(0, 20).forEach((item, index) => {
    if (yPos > 270) {
      doc.addPage();
      yPos = 20;
    }

    // Item header
    doc.setFontSize(10);
    doc.setTextColor(20, 184, 166);
    doc.text(`${index + 1}. ${item.title.substring(0, 80)}${item.title.length > 80 ? '...' : ''}`, 20, yPos);
    yPos += 5;

    // Meta
    doc.setFontSize(8);
    doc.setTextColor(100);
    doc.text(`${item.category} | ${item.threatLevel.toUpperCase()} | ${item.country} | ${item.source}`, 25, yPos);
    yPos += 4;

    // Summary
    const summaryLines = doc.splitTextToSize(item.summary, pageWidth - 50);
    doc.setTextColor(60);
    summaryLines.slice(0, 2).forEach((line: string) => {
      doc.text(line, 25, yPos);
      yPos += 4;
    });

    yPos += 6;
  });

  if (items.length > 20) {
    doc.setFontSize(8);
    doc.setTextColor(100);
    doc.text(`... and ${items.length - 20} more items`, 20, yPos);
  }

  doc.save(`${filename}-${new Date().toISOString().split('T')[0]}.pdf`);
}

export function exportToJSON(items: NewsItem[], filename: string = 'intel-report') {
  const jsonContent = JSON.stringify(items, null, 2);
  const blob = new Blob([jsonContent], { type: 'application/json' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `${filename}-${new Date().toISOString().split('T')[0]}.json`;
  link.click();
}
