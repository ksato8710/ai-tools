"use client";

import { useCallback, useState, useRef } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  addEdge,
  useNodesState,
  useEdgesState,
  type Connection,
  type Edge,
  type Node,
  type NodeTypes,
  type OnConnect,
  BackgroundVariant,
  MarkerType,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import EntityNode from "./EntityNode";
import Sidebar from "./Sidebar";
import PropertyPanel from "./PropertyPanel";
import Toolbar from "./Toolbar";
import AIAssistant from "./AIAssistant";
import SavedDiagramsPanel from "./SavedDiagramsPanel";
import EnumListPanel from "./EnumListPanel";
import type { Entity, Relation, ERDiagram } from "@/lib/er-schema";
import { createEntity, createRelation, cardinalityLabel } from "@/lib/er-schema";

const nodeTypes: NodeTypes = {
  entity: EntityNode,
};

export default function EREditor() {
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [entities, setEntities] = useState<Entity[]>([]);
  const [relations, setRelations] = useState<Relation[]>([]);
  const [selectedEntityId, setSelectedEntityId] = useState<string | null>(null);
  const [showPropertyPanel, setShowPropertyPanel] = useState(false);
  const [showAIPanel, setShowAIPanel] = useState(false);
  const [showSavedPanel, setShowSavedPanel] = useState(false);
  const [showEnumPanel, setShowEnumPanel] = useState(false);
  const [diagramName, setDiagramName] = useState("Untitled Diagram");
  const [currentDiagramId, setCurrentDiagramId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [hiddenEntityIds, setHiddenEntityIds] = useState<Set<string>>(new Set());
  const reactFlowWrapper = useRef<HTMLDivElement>(null);

  const selectedEntity = entities.find((e) => e.id === selectedEntityId) ?? null;

  // Sync entity data to node
  const updateNodeData = useCallback(
    (entityId: string, entity: Entity) => {
      setNodes((nds) =>
        nds.map((n) =>
          n.id === entityId
            ? {
                ...n,
                data: {
                  ...n.data,
                  label: entity.name,
                  attributes: entity.attributes,
                  selected: selectedEntityId === entityId,
                },
              }
            : {
                ...n,
                data: { ...n.data, selected: false },
              }
        )
      );
    },
    [setNodes, selectedEntityId]
  );

  const handleAddEntity = useCallback(
    (name: string) => {
      const offset = entities.length;
      const { entity, position } = createEntity(
        name,
        150 + (offset % 3) * 300,
        100 + Math.floor(offset / 3) * 250
      );

      setEntities((prev) => [...prev, entity]);

      const newNode: Node = {
        id: entity.id,
        type: "entity",
        position,
        data: {
          label: entity.name,
          attributes: entity.attributes,
          selected: false,
          onSelect: (id: string) => handleSelectEntity(id),
        },
      };
      setNodes((nds) => [...nds, newNode]);
    },
    [entities.length, setNodes]
  );

  const handleDeleteEntity = useCallback(
    (entityId: string) => {
      setEntities((prev) => prev.filter((e) => e.id !== entityId));
      setRelations((prev) =>
        prev.filter((r) => r.sourceEntityId !== entityId && r.targetEntityId !== entityId)
      );
      setNodes((nds) => nds.filter((n) => n.id !== entityId));
      setEdges((eds) => eds.filter((e) => e.source !== entityId && e.target !== entityId));
      if (selectedEntityId === entityId) {
        setSelectedEntityId(null);
        setShowPropertyPanel(false);
      }
    },
    [selectedEntityId, setNodes, setEdges]
  );

  const handleSelectEntity = useCallback(
    (entityId: string) => {
      setSelectedEntityId(entityId);
      setShowPropertyPanel(true);
      setNodes((nds) =>
        nds.map((n) => ({
          ...n,
          data: { ...n.data, selected: n.id === entityId },
        }))
      );
    },
    [setNodes]
  );

  const handleUpdateEntity = useCallback(
    (updated: Entity) => {
      setEntities((prev) =>
        prev.map((e) => (e.id === updated.id ? updated : e))
      );
      updateNodeData(updated.id, updated);
    },
    [updateNodeData]
  );

  const onConnect: OnConnect = useCallback(
    (connection: Connection) => {
      if (!connection.source || !connection.target) return;
      if (connection.source === connection.target) return;

      const rel = createRelation(connection.source, connection.target);
      setRelations((prev) => [...prev, rel]);

      const edge: Edge = {
        id: rel.id,
        source: connection.source,
        target: connection.target,
        label: cardinalityLabel(rel.sourceCardinality, rel.targetCardinality),
        markerEnd: { type: MarkerType.ArrowClosed, color: "#6B8F71" },
        style: { stroke: "#6B8F71", strokeWidth: 2 },
        labelStyle: { fontSize: 12, fontWeight: 600, fill: "#2C2C2C" },
        labelBgStyle: { fill: "#FAFAF5", fillOpacity: 0.9 },
        labelBgPadding: [4, 8] as [number, number],
        labelBgBorderRadius: 4,
      };
      setEdges((eds) => addEdge(edge, eds));
    },
    [setEdges]
  );

  const handleNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      handleSelectEntity(node.id);
    },
    [handleSelectEntity]
  );

  // Export
  const handleExport = useCallback(() => {
    const layout: ERDiagram["layout"] = {};
    nodes.forEach((n) => {
      layout[n.id] = { x: n.position.x, y: n.position.y };
    });
    const diagram: ERDiagram = {
      version: "1.0",
      name: diagramName,
      entities,
      relations,
      layout,
      hiddenEntityIds: hiddenEntityIds.size > 0 ? Array.from(hiddenEntityIds) : undefined,
    };
    const blob = new Blob([JSON.stringify(diagram, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${diagramName.replace(/\s+/g, "_")}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [nodes, diagramName, entities, relations, hiddenEntityIds]);

  // Import
  const handleImport = useCallback(
    (diagram: ERDiagram) => {
      setDiagramName(diagram.name);
      setEntities(diagram.entities);
      setRelations(diagram.relations);

      const newNodes: Node[] = diagram.entities.map((entity) => ({
        id: entity.id,
        type: "entity",
        position: diagram.layout[entity.id] ?? { x: 0, y: 0 },
        data: {
          label: entity.name,
          attributes: entity.attributes,
          selected: false,
          onSelect: (id: string) => handleSelectEntity(id),
        },
      }));

      const newEdges: Edge[] = diagram.relations.map((rel) => ({
        id: rel.id,
        source: rel.sourceEntityId,
        target: rel.targetEntityId,
        label: cardinalityLabel(rel.sourceCardinality, rel.targetCardinality),
        markerEnd: { type: MarkerType.ArrowClosed, color: "#6B8F71" },
        style: { stroke: "#6B8F71", strokeWidth: 2 },
        labelStyle: { fontSize: 12, fontWeight: 600, fill: "#2C2C2C" },
        labelBgStyle: { fill: "#FAFAF5", fillOpacity: 0.9 },
        labelBgPadding: [4, 8] as [number, number],
        labelBgBorderRadius: 4,
      }));

      setNodes(newNodes);
      setEdges(newEdges);
      setHiddenEntityIds(new Set(diagram.hiddenEntityIds ?? []));
      setSelectedEntityId(null);
      setShowPropertyPanel(false);
      if (diagram.id) {
        setCurrentDiagramId(diagram.id);
      } else {
        setCurrentDiagramId(null);
      }
    },
    [setNodes, setEdges, handleSelectEntity]
  );

  // AI: Apply generated
  const handleApplyGenerated = useCallback(
    (newEntities: Entity[], newRelations: Relation[], layout: ERDiagram["layout"]) => {
      setEntities(newEntities);
      setRelations(newRelations);

      const newNodes: Node[] = newEntities.map((entity) => ({
        id: entity.id,
        type: "entity",
        position: layout[entity.id] ?? { x: 0, y: 0 },
        data: {
          label: entity.name,
          attributes: entity.attributes,
          selected: false,
          onSelect: (id: string) => handleSelectEntity(id),
        },
      }));

      const newEdges: Edge[] = newRelations.map((rel) => ({
        id: rel.id,
        source: rel.sourceEntityId,
        target: rel.targetEntityId,
        label: cardinalityLabel(rel.sourceCardinality, rel.targetCardinality),
        markerEnd: { type: MarkerType.ArrowClosed, color: "#6B8F71" },
        style: { stroke: "#6B8F71", strokeWidth: 2 },
        labelStyle: { fontSize: 12, fontWeight: 600, fill: "#2C2C2C" },
        labelBgStyle: { fill: "#FAFAF5", fillOpacity: 0.9 },
        labelBgPadding: [4, 8] as [number, number],
        labelBgBorderRadius: 4,
      }));

      setNodes(newNodes);
      setEdges(newEdges);
    },
    [setNodes, setEdges, handleSelectEntity]
  );

  // AI: Apply suggested entities
  const handleApplyEntities = useCallback(
    (newEntities: Entity[]) => {
      const offset = entities.length;
      const addedNodes: Node[] = newEntities.map((entity, i) => ({
        id: entity.id,
        type: "entity",
        position: {
          x: 150 + ((offset + i) % 3) * 300,
          y: 100 + Math.floor((offset + i) / 3) * 250,
        },
        data: {
          label: entity.name,
          attributes: entity.attributes,
          selected: false,
          onSelect: (id: string) => handleSelectEntity(id),
        },
      }));

      setEntities((prev) => [...prev, ...newEntities]);
      setNodes((nds) => [...nds, ...addedNodes]);
    },
    [entities.length, setNodes, handleSelectEntity]
  );

  // AI: Apply suggested attributes
  const handleApplyAttributes = useCallback(
    (entityId: string, attributes: Entity["attributes"]) => {
      setEntities((prev) =>
        prev.map((e) =>
          e.id === entityId
            ? { ...e, attributes: [...e.attributes, ...attributes] }
            : e
        )
      );
      const entity = entities.find((e) => e.id === entityId);
      if (entity) {
        updateNodeData(entityId, {
          ...entity,
          attributes: [...entity.attributes, ...attributes],
        });
      }
    },
    [entities, updateNodeData]
  );

  // Visibility toggle
  const handleToggleEntityVisibility = useCallback((entityId: string) => {
    setHiddenEntityIds((prev) => {
      const next = new Set(prev);
      if (next.has(entityId)) {
        next.delete(entityId);
      } else {
        next.add(entityId);
      }
      return next;
    });
  }, []);

  const handleShowAllEntities = useCallback(() => {
    setHiddenEntityIds(new Set());
  }, []);

  // Apply hidden state to nodes and edges
  const visibleNodes = nodes.map((n) => ({
    ...n,
    hidden: hiddenEntityIds.has(n.id),
  }));

  const visibleEdges = edges.map((e) => ({
    ...e,
    hidden: hiddenEntityIds.has(e.source) || hiddenEntityIds.has(e.target),
  }));

  // Save
  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      const layout: ERDiagram["layout"] = {};
      nodes.forEach((n) => {
        layout[n.id] = { x: n.position.x, y: n.position.y };
      });
      const body: Record<string, unknown> = {
        version: "1.0",
        name: diagramName,
        entities,
        relations,
        layout,
        hiddenEntityIds: hiddenEntityIds.size > 0 ? Array.from(hiddenEntityIds) : undefined,
      };
      if (currentDiagramId) body.id = currentDiagramId;

      const res = await fetch("/api/diagrams", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      setCurrentDiagramId(data.id);
      setToast("Saved successfully");
      setTimeout(() => setToast(null), 2000);
    } catch {
      setToast("Failed to save");
      setTimeout(() => setToast(null), 2000);
    } finally {
      setSaving(false);
    }
  }, [nodes, diagramName, entities, relations, currentDiagramId, hiddenEntityIds]);

  // Load from saved
  const handleLoadDiagram = useCallback(
    async (id: string) => {
      try {
        const res = await fetch(`/api/diagrams/${id}`);
        if (!res.ok) throw new Error("Not found");
        const diagram: ERDiagram = await res.json();
        setCurrentDiagramId(diagram.id ?? id);
        handleImport(diagram);
        setShowSavedPanel(false);
      } catch {
        alert("Failed to load diagram.");
      }
    },
    [handleImport]
  );

  const currentDiagram: ERDiagram = {
    version: "1.0",
    name: diagramName,
    entities,
    relations,
    layout: Object.fromEntries(nodes.map((n) => [n.id, { x: n.position.x, y: n.position.y }])),
    hiddenEntityIds: hiddenEntityIds.size > 0 ? Array.from(hiddenEntityIds) : undefined,
  };

  return (
    <div className="flex flex-col h-[calc(100vh-56px)]">
      <Toolbar
        diagramName={diagramName}
        onDiagramNameChange={setDiagramName}
        onExport={handleExport}
        onImport={handleImport}
        onSave={handleSave}
        onToggleOpen={() => setShowSavedPanel(!showSavedPanel)}
        onToggleAI={() => setShowAIPanel(!showAIPanel)}
        onToggleEnums={() => setShowEnumPanel(!showEnumPanel)}
        saving={saving}
        aiOpen={showAIPanel}
        enumsOpen={showEnumPanel}
        hiddenCount={hiddenEntityIds.size}
        onShowAll={handleShowAllEntities}
      />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar
          entities={entities}
          selectedEntityId={selectedEntityId}
          onSelectEntity={handleSelectEntity}
          onAddEntity={handleAddEntity}
          onDeleteEntity={handleDeleteEntity}
          hiddenEntityIds={hiddenEntityIds}
          onToggleVisibility={handleToggleEntityVisibility}
        />

        <div className="flex-1 relative" ref={reactFlowWrapper}>
          <ReactFlow
            nodes={visibleNodes}
            edges={visibleEdges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={handleNodeClick}
            nodeTypes={nodeTypes}
            fitView
            className="bg-cream"
            defaultEdgeOptions={{
              style: { stroke: "#6B8F71", strokeWidth: 2 },
              markerEnd: { type: MarkerType.ArrowClosed, color: "#6B8F71" },
            }}
          >
            <Background
              variant={BackgroundVariant.Dots}
              gap={20}
              size={1}
              color="#D4D0C8"
            />
            <Controls
              className="!bg-surface !border-border-light !rounded-xl !shadow-sm"
            />
            <MiniMap
              nodeColor="#6B8F71"
              maskColor="rgba(250, 250, 245, 0.8)"
              className="!bg-card !border-border-light !rounded-xl"
            />
          </ReactFlow>

          {entities.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="text-center">
                <p className="text-text-muted text-sm mb-1">No entities yet</p>
                <p className="text-text-muted text-xs">
                  Use the sidebar or AI Assistant to add entities
                </p>
              </div>
            </div>
          )}
        </div>

        {showPropertyPanel && (
          <PropertyPanel
            entity={selectedEntity}
            onUpdateEntity={handleUpdateEntity}
            onClose={() => { setShowPropertyPanel(false); setSelectedEntityId(null); }}
          />
        )}

        {showAIPanel && (
          <AIAssistant
            diagram={currentDiagram}
            selectedEntity={selectedEntity}
            onApplyGenerated={handleApplyGenerated}
            onApplyEntities={handleApplyEntities}
            onApplyAttributes={handleApplyAttributes}
            onClose={() => setShowAIPanel(false)}
          />
        )}

        {showEnumPanel && (
          <EnumListPanel
            entities={entities}
            onUpdateEntity={handleUpdateEntity}
            onClose={() => setShowEnumPanel(false)}
          />
        )}

        {showSavedPanel && (
          <SavedDiagramsPanel
            onLoad={handleLoadDiagram}
            onClose={() => setShowSavedPanel(false)}
          />
        )}
      </div>

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-accent-leaf text-white px-4 py-2 rounded-full text-sm font-medium shadow-lg z-50">
          {toast}
        </div>
      )}
    </div>
  );
}
