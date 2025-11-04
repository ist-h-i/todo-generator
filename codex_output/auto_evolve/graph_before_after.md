# Workflow Graph (candidate)

```mermaid
flowchart LR

  Translator --> Planner
  Planner --> Coder
  Coder --> Code_Quality_Reviewer
  Coder --> Security_Reviewer
  Security_Reviewer --> Integrator
  Code_Quality_Reviewer --> Integrator
  Integrator --> Release_Manager
  Release_Manager --> Doc-Writer
  Doc-Writer --> Doc_Editor
```
