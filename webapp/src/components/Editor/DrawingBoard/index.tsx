import React, { useEffect, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';

import { AppState } from 'app/rootReducer';
import { ToolType, setTool } from 'features/boardSlices';
import { Metadata } from 'features/peerSlices';
import { BoardMetadata } from './Canvas/Worker';
import Board from './Canvas/Board';
import './index.scss';

export default function DrawingBoard({ width, height }: { width: number; height: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const boardRef = useRef<Board | null>(null);
  const dispatch = useDispatch();
  const client = useSelector((state: AppState) => state.docState.client);
  const doc = useSelector((state: AppState) => state.docState.doc);
  const tool = useSelector((state: AppState) => state.boardState.tool);
  const color = useSelector((state: AppState) => state.boardState.color);

  useEffect(() => {
    if (!canvasRef.current) {
      return () => {};
    }
    const board = new Board(canvasRef.current, doc!.update.bind(doc));
    boardRef.current = board;

    return () => {
      board.destroy();
    };
  }, [doc]);

  useEffect(() => {
    if (!doc) {
      return () => {};
    }

    const unsubscribe = doc.subscribe((event) => {
      if (event.type === 'remote-change') {
        boardRef.current?.drawAll(doc.getRoot().shapes);
      }
    });

    return () => {
      unsubscribe();
    };
  }, [doc]);

  useEffect(() => {
    if (!client || !doc) {
      return () => {};
    }

    const unsubscribe = client.subscribe((event) => {
      if (event.type === 'peers-changed') {
        const documentKey = doc.getKey();
        const changedPeers = event.value[documentKey];

        for (const peerKey of Object.keys(changedPeers)) {
          boardRef.current?.updateMetadata(peerKey, changedPeers[peerKey]);
        }
      }
    });

    const clientId = client.getID()!;
    const handleUpdateMeta = (data: BoardMetadata) => {
      const board = JSON.stringify(data);
      boardRef.current?.updateMetadata(clientId, {
        board,
      } as Metadata);
      client?.updateMetadata('board', board);
    };

    boardRef.current?.addEventListener('mousemove', handleUpdateMeta);
    boardRef.current?.addEventListener('mousedown', handleUpdateMeta);
    boardRef.current?.addEventListener('mouseout', handleUpdateMeta);
    boardRef.current?.addEventListener('mouseup', handleUpdateMeta);

    return () => {
      unsubscribe();
      boardRef.current?.removeEventListener('mousemove', handleUpdateMeta);
      boardRef.current?.removeEventListener('mousedown', handleUpdateMeta);
      boardRef.current?.removeEventListener('mouseout', handleUpdateMeta);
      boardRef.current?.removeEventListener('mouseup', handleUpdateMeta);
    };
  }, [doc]);

  useEffect(() => {
    const handleMouseup = () => {
      if (tool === ToolType.Rect) {
        dispatch(setTool(ToolType.Selector));
      }
    };

    boardRef.current?.addEventListener('mouseup', handleMouseup);
    return () => {
      boardRef.current?.removeEventListener('mouseup', handleMouseup);
    };
  }, [doc, tool]);

  useEffect(() => {
    if (!canvasRef.current) {
      return;
    }

    boardRef.current?.setWidth(width);
    boardRef.current?.setHeight(height);
    boardRef.current?.drawAll(doc!.getRoot().shapes);
  }, [doc, width, height]);

  useEffect(() => {
    boardRef.current?.setTool(tool);
  }, [doc, tool]);

  useEffect(() => {
    boardRef.current?.setColor(color);
  }, [doc, color]);

  useEffect(() => {
    if (tool === ToolType.Clear) {
      boardRef.current?.clearBoard();
      dispatch(setTool(ToolType.None));
    }
  }, [doc, tool]);

  return <canvas ref={canvasRef} />;
}
