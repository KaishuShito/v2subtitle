import React, { useState, useEffect, useCallback } from 'react';
import { TranscriptLine } from '../types';
import { formatTime } from '../utils/time';

interface TranscriptViewerProps {
  transcript: TranscriptLine[];
  currentTime: number;
  onLineClick: (line: TranscriptLine) => void;
  onLineEdit: (index: number, text: string) => void;
  onLineDelete: (index: number) => void;
  onBulkReplace?: (searchText: string, replaceText: string) => number;
}

export const TranscriptViewer: React.FC<TranscriptViewerProps> = ({
  transcript,
  currentTime,
  onLineClick,
  onLineEdit,
  onLineDelete,
  onBulkReplace,
}) => {
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [replaceText, setReplaceText] = useState('');
  const [searchResults, setSearchResults] = useState<{index: number, start: number, end: number}[]>([]);
  const [currentResultIndex, setCurrentResultIndex] = useState(0);

  // キーボードショートカット (⌘F / Ctrl+F)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'f') {
        e.preventDefault();
        setShowSearchModal(true);
      }
      if (e.key === 'Escape') {
        setShowSearchModal(false);
        setSearchResults([]);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  // 検索機能
  const performSearch = useCallback(() => {
    if (!searchText.trim()) {
      setSearchResults([]);
      return;
    }

    const results: {index: number, start: number, end: number}[] = [];
    const searchRegex = new RegExp(searchText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
    
    transcript.forEach((line, lineIndex) => {
      let match;
      while ((match = searchRegex.exec(line.text)) !== null) {
        results.push({
          index: lineIndex,
          start: match.index,
          end: match.index + match[0].length
        });
      }
    });
    
    setSearchResults(results);
    setCurrentResultIndex(0);
  }, [searchText, transcript]);

  // 検索テキストが変更されたら自動検索
  useEffect(() => {
    performSearch();
  }, [performSearch]);

  // テキストハイライト機能
  const highlightText = (text: string, lineIndex: number) => {
    if (!searchText.trim() || searchResults.length === 0) {
      return text;
    }

    const lineResults = searchResults.filter(result => result.index === lineIndex);
    if (lineResults.length === 0) {
      return text;
    }

    let highlightedText = text;
    const searchRegex = new RegExp(`(${searchText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    
    highlightedText = text.replace(searchRegex, '<mark class="bg-yellow-200">$1</mark>');
    
    return highlightedText;
  };

  // 一括置換機能
  const handleBulkReplace = () => {
    if (!searchText.trim() || !onBulkReplace) return;
    
    const replacedCount = onBulkReplace(searchText, replaceText);
    alert(`${replacedCount}箇所を置換しました`);
    setShowSearchModal(false);
    setSearchText('');
    setReplaceText('');
    setSearchResults([]);
  };

  // 次の検索結果へ移動
  const goToNextResult = () => {
    if (searchResults.length === 0) return;
    setCurrentResultIndex((prev) => (prev + 1) % searchResults.length);
  };

  // 前の検索結果へ移動
  const goToPrevResult = () => {
    if (searchResults.length === 0) return;
    setCurrentResultIndex((prev) => (prev - 1 + searchResults.length) % searchResults.length);
  };
  return (
    <div className="relative">
      {/* 検索・置換モーダル */}
      {showSearchModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-lg w-96">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">検索・置換</h3>
              <button
                onClick={() => setShowSearchModal(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">検索</label>
                <div className="flex items-center space-x-2">
                  <input
                    type="text"
                    value={searchText}
                    onChange={(e) => setSearchText(e.target.value)}
                    placeholder="検索したいテキストを入力"
                    className="flex-1 p-2 border rounded text-sm"
                    autoFocus
                  />
                  <div className="text-xs text-gray-500">
                    {searchResults.length > 0 && `${currentResultIndex + 1}/${searchResults.length}`}
                  </div>
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1">置換</label>
                <input
                  type="text"
                  value={replaceText}
                  onChange={(e) => setReplaceText(e.target.value)}
                  placeholder="置換後のテキストを入力"
                  className="w-full p-2 border rounded text-sm"
                />
              </div>
              
              <div className="flex justify-between items-center">
                <div className="flex space-x-2">
                  <button
                    onClick={goToPrevResult}
                    disabled={searchResults.length === 0}
                    className="px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 rounded disabled:opacity-50"
                  >
                    ↑ 前へ
                  </button>
                  <button
                    onClick={goToNextResult}
                    disabled={searchResults.length === 0}
                    className="px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 rounded disabled:opacity-50"
                  >
                    ↓ 次へ
                  </button>
                </div>
                
                <div className="flex space-x-2">
                  <button
                    onClick={() => setShowSearchModal(false)}
                    className="px-4 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded"
                  >
                    キャンセル
                  </button>
                  <button
                    onClick={handleBulkReplace}
                    disabled={!searchText.trim() || searchResults.length === 0}
                    className="px-4 py-2 text-sm bg-blue-500 hover:bg-blue-600 text-white rounded disabled:opacity-50"
                  >
                    すべて置換
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* 検索ボタン */}
      <div className="flex justify-between items-center mb-2">
        <h3 className="text-lg font-semibold">文字起こし一覧</h3>
        <button
          onClick={() => setShowSearchModal(true)}
          className="px-3 py-1 text-sm bg-blue-500 hover:bg-blue-600 text-white rounded flex items-center space-x-1"
        >
          <span>🔍</span>
          <span>検索・置換</span>
          <span className="text-xs opacity-75">(⌘F)</span>
        </button>
      </div>
      
      <div className="space-y-2 max-h-96 overflow-y-auto p-4 bg-gray-50 rounded-lg">
      {transcript.map((line, index) => {
        const isActive = currentTime >= line.start && currentTime <= line.end;
        
        return (
          <div
            key={index}
            className={`p-3 rounded cursor-pointer transition-colors ${
              isActive ? 'bg-blue-100 border-blue-500 border' : 'bg-white hover:bg-gray-100'
            }`}
            onClick={() => onLineClick(line)}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-gray-500">
                {formatTime(line.start)} - {formatTime(line.end)}
              </span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onLineDelete(index);
                }}
                className="text-red-500 hover:text-red-700 text-sm"
              >
                削除
              </button>
            </div>
            <div className="relative">
              <input
                type="text"
                value={line.text}
                onChange={(e) => onLineEdit(index, e.target.value)}
                onClick={(e) => e.stopPropagation()}
                className={`w-full p-1 border rounded text-sm ${
                  searchText.trim() && line.text.toLowerCase().includes(searchText.toLowerCase()) 
                    ? 'bg-yellow-50 border-yellow-300' 
                    : ''
                }`}
              />
            </div>
          </div>
        );
      })}
      </div>
    </div>
  );
};