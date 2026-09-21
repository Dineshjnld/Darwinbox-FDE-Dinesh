#!/bin/bash
# Demo Recording Script for Darwinbox Migration Copilot
# Run this after starting the stack with: docker compose up -d

echo "=== Darwinbox Migration Copilot Demo ==="
echo ""
echo "Step 1: Open http://localhost:5173"
echo "Step 2: Click 'Create demo migration'"
echo "Step 3: Watch the agent profile 4 source files and create mappings"
echo "Step 4: Go to 'Escalations' tab - see 2 review cards"
echo "Step 5: Click 'Approve' on each escalation"
echo "Step 6: Watch the graph resume and execute"
echo "Step 7: See EMP005 fail, then retry and succeed"
echo "Step 8: Check 'Audit' tab for full lineage"
echo ""
echo "All acceptance criteria demonstrated:"
echo "1. Multi-file ingestion (CSV + XLSX with different columns)"
echo "2. Autonomous mapping (25 auto + 1 review decisions)"
echo "3. Defensible escalation boundary (ambiguous_mapping + conflicting_source)"
echo "4. Mock integration with retry/rollback"
echo "5. Human-in-the-loop UI (escalation queue)"
echo "6. Full audit trail (50+ events)"
