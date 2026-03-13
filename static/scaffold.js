// ── Scaffold Generator ──
document.addEventListener('DOMContentLoaded', function () {
    const schemaBody = document.getElementById('schemaBody');
    const outputTabs = document.getElementById('outputTabs');
    const outputArea = document.getElementById('outputArea');
    const colCount = document.getElementById('colCount');

    const DATA_TYPES = ['UUID','String','Text','Integer','Long','Double','Decimal','Boolean','Date','DateTime','Timestamp','Enum','JSON','Blob'];

    let columns = [];
    let generated = {}; // { tabName: code }
    let activeTab = '';

    // ── Column Management ──
    function addColumn(col) {
        columns.push({
            name: col?.name || '',
            type: col?.type || 'String',
            length: col?.length || '',
            pk: col?.pk || false,
            nn: col?.nn || false,
            uq: col?.uq || false,
            ai: col?.ai || false,
            def: col?.def || '',
            ref: col?.ref || '',
        });
        renderSchema();
    }

    function renderSchema() {
        colCount.textContent = columns.length + ' columns';
        schemaBody.innerHTML = columns.map((c, i) => `<tr draggable="true" data-idx="${i}">
            <td class="row-num" style="cursor:grab; white-space:nowrap;"><i class="bi bi-grip-vertical" style="font-size:0.7rem; color:var(--bs-secondary-color);"></i>${i + 1}</td>
            <td><input type="text" class="col-name w-100" value="${esc(c.name)}" data-idx="${i}" data-f="name" placeholder="column_name"></td>
            <td><select class="col-type" data-idx="${i}" data-f="type">${DATA_TYPES.map(t => `<option ${t === c.type ? 'selected' : ''}>${t}</option>`).join('')}</select></td>
            <td><input type="number" class="col-len w-100" value="${c.length}" data-idx="${i}" data-f="length" placeholder="—" min="0"></td>
            <td class="col-chk"><input type="checkbox" ${c.pk ? 'checked' : ''} data-idx="${i}" data-f="pk"></td>
            <td class="col-chk"><input type="checkbox" ${c.nn ? 'checked' : ''} data-idx="${i}" data-f="nn"></td>
            <td class="col-chk"><input type="checkbox" ${c.uq ? 'checked' : ''} data-idx="${i}" data-f="uq"></td>
            <td class="col-chk"><input type="checkbox" ${c.ai ? 'checked' : ''} data-idx="${i}" data-f="ai"></td>
            <td><input type="text" class="col-def w-100" value="${esc(c.def)}" data-idx="${i}" data-f="def" placeholder="—"></td>
            <td><input type="text" class="w-100" value="${esc(c.ref)}" data-idx="${i}" data-f="ref" placeholder="table.col" style="font-size:0.78rem;"></td>
            <td><div class="d-flex gap-1">
                <button class="btn btn-sm btn-outline-secondary py-0 px-1" onclick="moveCol(${i},-1)" title="Up"><i class="bi bi-arrow-up"></i></button>
                <button class="btn btn-sm btn-outline-secondary py-0 px-1" onclick="moveCol(${i},1)" title="Down"><i class="bi bi-arrow-down"></i></button>
                <button class="btn btn-sm btn-outline-danger py-0 px-1" onclick="delCol(${i})" title="Delete"><i class="bi bi-x"></i></button>
            </div></td>
        </tr>`).join('');

        schemaBody.querySelectorAll('input, select').forEach(el => {
            el.addEventListener('change', function () {
                const idx = parseInt(this.dataset.idx);
                const f = this.dataset.f;
                columns[idx][f] = this.type === 'checkbox' ? this.checked : this.value;
            });
        });

        // Drag and drop rows
        let dragIdx = null;
        schemaBody.querySelectorAll('tr[draggable]').forEach(tr => {
            tr.addEventListener('dragstart', function (e) {
                dragIdx = parseInt(this.dataset.idx);
                this.style.opacity = '0.4';
                e.dataTransfer.effectAllowed = 'move';
            });
            tr.addEventListener('dragend', function () {
                this.style.opacity = '';
                dragIdx = null;
                schemaBody.querySelectorAll('tr').forEach(r => r.style.borderTop = '');
            });
            tr.addEventListener('dragover', function (e) {
                e.preventDefault();
                if (dragIdx === null) return;
                schemaBody.querySelectorAll('tr').forEach(r => r.style.borderTop = '');
                this.style.borderTop = '2px solid var(--bs-primary)';
            });
            tr.addEventListener('drop', function (e) {
                e.preventDefault();
                this.style.borderTop = '';
                if (dragIdx === null) return;
                const targetIdx = parseInt(this.dataset.idx);
                if (dragIdx === targetIdx) return;
                const [moved] = columns.splice(dragIdx, 1);
                columns.splice(targetIdx, 0, moved);
                renderSchema();
            });
        });
    }

    window.delCol = function (i) {
        const name = columns[i]?.name || 'this column';
        if (!confirm(`Delete column "${name}"?`)) return;
        columns.splice(i, 1);
        renderSchema();
    };
    window.moveCol = function (i, dir) {
        const ni = i + dir;
        if (ni < 0 || ni >= columns.length) return;
        [columns[i], columns[ni]] = [columns[ni], columns[i]];
        renderSchema();
    };

    document.getElementById('addRowBtn').addEventListener('click', () => addColumn());

    // Presets
    document.querySelectorAll('.preset-btn').forEach(btn => {
        btn.addEventListener('click', function () {
            const p = this.dataset.preset;
            if (p === 'id') {
                columns.unshift({ name: 'id', type: 'UUID', length: '', pk: true, nn: true, uq: false, ai: false, def: 'gen_random_uuid()', ref: '' });
            } else if (p === 'audit') {
                columns.push({ name: 'created_at', type: 'Timestamp', length: '', pk: false, nn: true, uq: false, ai: false, def: 'NOW()', ref: '' });
                columns.push({ name: 'updated_at', type: 'Timestamp', length: '', pk: false, nn: true, uq: false, ai: false, def: 'NOW()', ref: '' });
                columns.push({ name: 'created_by', type: 'String', length: '100', pk: false, nn: false, uq: false, ai: false, def: '', ref: '' });
                columns.push({ name: 'updated_by', type: 'String', length: '100', pk: false, nn: false, uq: false, ai: false, def: '', ref: '' });
            } else if (p === 'softdelete') {
                columns.push({ name: 'deleted_at', type: 'Timestamp', length: '', pk: false, nn: false, uq: false, ai: false, def: '', ref: '' });
                columns.push({ name: 'is_deleted', type: 'Boolean', length: '', pk: false, nn: true, uq: false, ai: false, def: 'false', ref: '' });
            }
            renderSchema();
        });
    });

    // ── Naming Helpers ──
    function toPascal(s) { return s.replace(/(^|_)(\w)/g, (_, __, c) => c.toUpperCase()); }
    function toCamel(s) { const p = toPascal(s); return p[0].toLowerCase() + p.slice(1); }
    function toKebab(s) { return s.replace(/_/g, '-').toLowerCase(); }
    function toSnake(s) { return s.replace(/([A-Z])/g, '_$1').toLowerCase().replace(/^_/, ''); }
    function singular(s) { return s.endsWith('ies') ? s.slice(0, -3) + 'y' : s.endsWith('s') ? s.slice(0, -1) : s; }
    function getEntityName() { return toPascal(singular(document.getElementById('tableName').value || 'entity')); }
    function getTableName() { return document.getElementById('tableName').value || 'table'; }

    // ── GENERATE ──
    document.getElementById('generateBtn').addEventListener('click', generate);

    function generate() {
        generated = {};
        const checks = document.querySelectorAll('.gen-cb:checked');
        checks.forEach(cb => {
            const gen = cb.dataset.gen;
            const fns = generators[gen];
            if (fns) {
                for (const [name, fn] of Object.entries(fns)) {
                    generated[`${gen}: ${name}`] = fn();
                }
            }
        });

        // Render tabs
        const tabs = Object.keys(generated);
        if (tabs.length === 0) {
            outputArea.textContent = 'Select at least one generator and click Generate.';
            outputTabs.innerHTML = '';
            return;
        }

        activeTab = tabs[0];
        outputTabs.innerHTML = tabs.map((t, i) => `<li class="nav-item"><a class="nav-link ${i === 0 ? 'active' : ''}" href="#" data-tab="${t}">${t}</a></li>`).join('');
        outputArea.textContent = generated[activeTab];

        outputTabs.querySelectorAll('.nav-link').forEach(a => {
            a.addEventListener('click', function (e) {
                e.preventDefault();
                activeTab = this.dataset.tab;
                outputTabs.querySelectorAll('.nav-link').forEach(x => x.classList.remove('active'));
                this.classList.add('active');
                outputArea.textContent = generated[activeTab];
            });
        });
    }

    // Copy
    document.getElementById('copyOutputBtn').addEventListener('click', function () {
        navigator.clipboard.writeText(outputArea.textContent).then(() => {
            this.innerHTML = '<i class="bi bi-check-lg text-success"></i> Copied!';
            setTimeout(() => { this.innerHTML = '<i class="bi bi-clipboard"></i> Copy'; }, 1500);
        });
    });

    // ── Type Mappings ──
    const sqlTypeMap = {
        postgresql: { UUID: 'UUID', String: 'VARCHAR', Text: 'TEXT', Integer: 'INTEGER', Long: 'BIGINT', Double: 'DOUBLE PRECISION', Decimal: 'DECIMAL', Boolean: 'BOOLEAN', Date: 'DATE', DateTime: 'TIMESTAMP', Timestamp: 'TIMESTAMP', Enum: 'VARCHAR', JSON: 'JSONB', Blob: 'BYTEA' },
        mysql: { UUID: 'CHAR(36)', String: 'VARCHAR', Text: 'TEXT', Integer: 'INT', Long: 'BIGINT', Double: 'DOUBLE', Decimal: 'DECIMAL', Boolean: 'TINYINT(1)', Date: 'DATE', DateTime: 'DATETIME', Timestamp: 'TIMESTAMP', Enum: 'VARCHAR', JSON: 'JSON', Blob: 'BLOB' },
        sqlserver: { UUID: 'UNIQUEIDENTIFIER', String: 'NVARCHAR', Text: 'NVARCHAR(MAX)', Integer: 'INT', Long: 'BIGINT', Double: 'FLOAT', Decimal: 'DECIMAL', Boolean: 'BIT', Date: 'DATE', DateTime: 'DATETIME2', Timestamp: 'DATETIME2', Enum: 'NVARCHAR', JSON: 'NVARCHAR(MAX)', Blob: 'VARBINARY(MAX)' },
        sqlite: { UUID: 'TEXT', String: 'TEXT', Text: 'TEXT', Integer: 'INTEGER', Long: 'INTEGER', Double: 'REAL', Decimal: 'REAL', Boolean: 'INTEGER', Date: 'TEXT', DateTime: 'TEXT', Timestamp: 'TEXT', Enum: 'TEXT', JSON: 'TEXT', Blob: 'BLOB' },
    };
    const javaTypeMap = { UUID: 'UUID', String: 'String', Text: 'String', Integer: 'Integer', Long: 'Long', Double: 'Double', Decimal: 'BigDecimal', Boolean: 'Boolean', Date: 'LocalDate', DateTime: 'LocalDateTime', Timestamp: 'LocalDateTime', Enum: 'String', JSON: 'String', Blob: 'byte[]' };
    const tsTypeMap = { UUID: 'string', String: 'string', Text: 'string', Integer: 'number', Long: 'number', Double: 'number', Decimal: 'number', Boolean: 'boolean', Date: 'string', DateTime: 'string', Timestamp: 'string', Enum: 'string', JSON: 'any', Blob: 'Blob' };
    const pyTypeMap = { UUID: 'UUID', String: 'str', Text: 'str', Integer: 'int', Long: 'int', Double: 'float', Decimal: 'Decimal', Boolean: 'bool', Date: 'date', DateTime: 'datetime', Timestamp: 'datetime', Enum: 'str', JSON: 'dict', Blob: 'bytes' };
    const goTypeMap = { UUID: 'uuid.UUID', String: 'string', Text: 'string', Integer: 'int32', Long: 'int64', Double: 'float64', Decimal: 'float64', Boolean: 'bool', Date: 'time.Time', DateTime: 'time.Time', Timestamp: 'time.Time', Enum: 'string', JSON: 'json.RawMessage', Blob: '[]byte' };
    const csTypeMap = { UUID: 'Guid', String: 'string', Text: 'string', Integer: 'int', Long: 'long', Double: 'double', Decimal: 'decimal', Boolean: 'bool', Date: 'DateOnly', DateTime: 'DateTime', Timestamp: 'DateTime', Enum: 'string', JSON: 'string', Blob: 'byte[]' };
    const saTypeMap = { UUID: 'UUID', String: 'String', Text: 'Text', Integer: 'Integer', Long: 'BigInteger', Double: 'Float', Decimal: 'Numeric', Boolean: 'Boolean', Date: 'Date', DateTime: 'DateTime', Timestamp: 'DateTime', Enum: 'String', JSON: 'JSON', Blob: 'LargeBinary' };

    // ── Generators ──
    const generators = {
        sql: {
            'DDL': () => {
                const db = document.getElementById('dbDialect').value;
                const table = getTableName();
                const map = sqlTypeMap[db];
                const pks = columns.filter(c => c.pk).map(c => c.name);
                const lines = columns.map(c => {
                    let t = map[c.type] || 'TEXT';
                    if ((c.type === 'String' || c.type === 'Enum') && c.length) t = `${map[c.type]}(${c.length})`;
                    else if (c.type === 'Decimal' && c.length) t = `DECIMAL(${c.length})`;
                    let line = `    ${c.name} ${t}`;
                    if (c.ai && db === 'postgresql') { line = `    ${c.name} SERIAL`; if (c.type === 'Long') line = `    ${c.name} BIGSERIAL`; }
                    else if (c.ai && db === 'mysql') line += ' AUTO_INCREMENT';
                    else if (c.ai && db === 'sqlserver') line += ' IDENTITY(1,1)';
                    if (c.nn) line += ' NOT NULL';
                    if (c.uq) line += ' UNIQUE';
                    if (c.def) line += ` DEFAULT ${c.def}`;
                    return line;
                });
                if (pks.length > 0) lines.push(`    PRIMARY KEY (${pks.join(', ')})`);
                columns.filter(c => c.ref).forEach(c => {
                    const [refTable, refCol] = c.ref.split('.');
                    lines.push(`    FOREIGN KEY (${c.name}) REFERENCES ${refTable}(${refCol || 'id'})`);
                });
                return `CREATE TABLE ${table} (\n${lines.join(',\n')}\n);`;
            }
        },
        java: {
            'Entity': () => {
                const e = getEntityName();
                const pkg = document.getElementById('packageName').value;
                let code = `package ${pkg}.entity;\n\nimport jakarta.persistence.*;\nimport java.util.*;\nimport java.time.*;\nimport java.math.*;\nimport lombok.*;\n\n@Entity\n@Table(name = "${getTableName()}")\n@Data\n@NoArgsConstructor\n@AllArgsConstructor\n@Builder\npublic class ${e} {\n\n`;
                columns.forEach(c => {
                    if (c.pk) code += '    @Id\n';
                    if (c.pk && c.type === 'UUID') code += '    @GeneratedValue(strategy = GenerationType.UUID)\n';
                    if (c.pk && c.ai) code += '    @GeneratedValue(strategy = GenerationType.IDENTITY)\n';
                    if (c.type === 'Text') code += '    @Column(columnDefinition = "TEXT")\n';
                    else if (c.length) code += `    @Column(length = ${c.length})\n`;
                    code += `    private ${javaTypeMap[c.type] || 'String'} ${toCamel(c.name)};\n\n`;
                });
                code += '}\n';
                return code;
            },
            'Repository': () => {
                const e = getEntityName();
                const pkg = document.getElementById('packageName').value;
                const pkCol = columns.find(c => c.pk);
                const pkType = pkCol ? (javaTypeMap[pkCol.type] || 'Long') : 'Long';
                return `package ${pkg}.repository;\n\nimport ${pkg}.entity.${e};\nimport org.springframework.data.jpa.repository.JpaRepository;\nimport org.springframework.stereotype.Repository;\n\n@Repository\npublic interface ${e}Repository extends JpaRepository<${e}, ${pkType}> {\n}\n`;
            },
            'Service': () => {
                const e = getEntityName();
                const v = toCamel(e);
                const pkg = document.getElementById('packageName').value;
                const pkCol = columns.find(c => c.pk);
                const pkType = pkCol ? (javaTypeMap[pkCol.type] || 'Long') : 'Long';
                return `package ${pkg}.service;\n\nimport ${pkg}.entity.${e};\nimport ${pkg}.repository.${e}Repository;\nimport lombok.RequiredArgsConstructor;\nimport org.springframework.stereotype.Service;\nimport java.util.*;\n\n@Service\n@RequiredArgsConstructor\npublic class ${e}Service {\n\n    private final ${e}Repository ${v}Repository;\n\n    public List<${e}> findAll() {\n        return ${v}Repository.findAll();\n    }\n\n    public Optional<${e}> findById(${pkType} id) {\n        return ${v}Repository.findById(id);\n    }\n\n    public ${e} save(${e} ${v}) {\n        return ${v}Repository.save(${v});\n    }\n\n    public void deleteById(${pkType} id) {\n        ${v}Repository.deleteById(id);\n    }\n}\n`;
            },
            'Controller': () => {
                const e = getEntityName();
                const v = toCamel(e);
                const path = toKebab(getTableName());
                const pkg = document.getElementById('packageName').value;
                const pkCol = columns.find(c => c.pk);
                const pkType = pkCol ? (javaTypeMap[pkCol.type] || 'Long') : 'Long';
                return `package ${pkg}.controller;\n\nimport ${pkg}.entity.${e};\nimport ${pkg}.service.${e}Service;\nimport lombok.RequiredArgsConstructor;\nimport org.springframework.http.*;\nimport org.springframework.web.bind.annotation.*;\nimport java.util.*;\n\n@RestController\n@RequestMapping("/api/${path}")\n@RequiredArgsConstructor\npublic class ${e}Controller {\n\n    private final ${e}Service ${v}Service;\n\n    @GetMapping\n    public List<${e}> findAll() {\n        return ${v}Service.findAll();\n    }\n\n    @GetMapping("/{id}")\n    public ResponseEntity<${e}> findById(@PathVariable ${pkType} id) {\n        return ${v}Service.findById(id)\n                .map(ResponseEntity::ok)\n                .orElse(ResponseEntity.notFound().build());\n    }\n\n    @PostMapping\n    public ResponseEntity<${e}> create(@RequestBody ${e} ${v}) {\n        return ResponseEntity.status(HttpStatus.CREATED).body(${v}Service.save(${v}));\n    }\n\n    @PutMapping("/{id}")\n    public ResponseEntity<${e}> update(@PathVariable ${pkType} id, @RequestBody ${e} ${v}) {\n        return ${v}Service.findById(id)\n                .map(existing -> ResponseEntity.ok(${v}Service.save(${v})))\n                .orElse(ResponseEntity.notFound().build());\n    }\n\n    @DeleteMapping("/{id}")\n    public ResponseEntity<Void> delete(@PathVariable ${pkType} id) {\n        ${v}Service.deleteById(id);\n        return ResponseEntity.noContent().build();\n    }\n}\n`;
            },
            'DTO': () => {
                const e = getEntityName();
                const pkg = document.getElementById('packageName').value;
                let code = `package ${pkg}.dto;\n\nimport java.util.*;\nimport java.time.*;\nimport java.math.*;\nimport lombok.*;\n\n@Data\n@NoArgsConstructor\n@AllArgsConstructor\npublic class ${e}DTO {\n\n`;
                columns.filter(c => !c.pk || c.type === 'UUID').forEach(c => {
                    code += `    private ${javaTypeMap[c.type] || 'String'} ${toCamel(c.name)};\n`;
                });
                code += '}\n';
                return code;
            },
        },
        csharp: {
            'Entity': () => {
                const e = getEntityName();
                let code = `using System;\nusing System.ComponentModel.DataAnnotations;\nusing System.ComponentModel.DataAnnotations.Schema;\n\nnamespace App.Entities;\n\n[Table("${getTableName()}")]\npublic class ${e}\n{\n`;
                columns.forEach(c => {
                    if (c.pk) code += '    [Key]\n';
                    if (c.length) code += `    [MaxLength(${c.length})]\n`;
                    if (c.nn && c.type === 'String') code += '    [Required]\n';
                    const nullable = !c.nn && !c.pk ? '?' : '';
                    code += `    public ${csTypeMap[c.type] || 'string'}${nullable} ${toPascal(c.name)} { get; set; }\n\n`;
                });
                code += '}\n';
                return code;
            },
            'Controller': () => {
                const e = getEntityName();
                const v = toCamel(e);
                const path = toKebab(getTableName());
                return `using Microsoft.AspNetCore.Mvc;\nusing App.Entities;\nusing App.Data;\nusing Microsoft.EntityFrameworkCore;\n\nnamespace App.Controllers;\n\n[ApiController]\n[Route("api/${path}")]\npublic class ${e}Controller : ControllerBase\n{\n    private readonly AppDbContext _db;\n\n    public ${e}Controller(AppDbContext db) => _db = db;\n\n    [HttpGet]\n    public async Task<ActionResult<List<${e}>>> GetAll()\n        => await _db.${e}s.ToListAsync();\n\n    [HttpGet("{id}")]\n    public async Task<ActionResult<${e}>> GetById(Guid id)\n    {\n        var ${v} = await _db.${e}s.FindAsync(id);\n        return ${v} is null ? NotFound() : Ok(${v});\n    }\n\n    [HttpPost]\n    public async Task<ActionResult<${e}>> Create(${e} ${v})\n    {\n        _db.${e}s.Add(${v});\n        await _db.SaveChangesAsync();\n        return CreatedAtAction(nameof(GetById), new { id = ${v}.${toPascal(columns.find(c => c.pk)?.name || 'id')} }, ${v});\n    }\n\n    [HttpPut("{id}")]\n    public async Task<IActionResult> Update(Guid id, ${e} ${v})\n    {\n        _db.Entry(${v}).State = EntityState.Modified;\n        await _db.SaveChangesAsync();\n        return NoContent();\n    }\n\n    [HttpDelete("{id}")]\n    public async Task<IActionResult> Delete(Guid id)\n    {\n        var ${v} = await _db.${e}s.FindAsync(id);\n        if (${v} is null) return NotFound();\n        _db.${e}s.Remove(${v});\n        await _db.SaveChangesAsync();\n        return NoContent();\n    }\n}\n`;
            },
        },
        python: {
            'Model (SQLAlchemy)': () => {
                const e = getEntityName();
                let code = `from sqlalchemy import Column, ${[...new Set(columns.map(c => saTypeMap[c.type]))].join(', ')}\nfrom sqlalchemy.orm import DeclarativeBase\nimport uuid\n\nclass Base(DeclarativeBase):\n    pass\n\nclass ${e}(Base):\n    __tablename__ = "${getTableName()}"\n\n`;
                columns.forEach(c => {
                    let args = saTypeMap[c.type] || 'String';
                    if (c.length && (c.type === 'String' || c.type === 'Enum')) args = `String(${c.length})`;
                    let extras = [];
                    if (c.pk) extras.push('primary_key=True');
                    if (c.nn && !c.pk) extras.push('nullable=False');
                    if (!c.nn && !c.pk) extras.push('nullable=True');
                    if (c.uq) extras.push('unique=True');
                    if (c.def) extras.push(`default=${c.def}`);
                    code += `    ${c.name} = Column(${args}${extras.length ? ', ' + extras.join(', ') : ''})\n`;
                });
                return code;
            },
            'Schema (Pydantic)': () => {
                const e = getEntityName();
                let imports = new Set(['BaseModel']);
                columns.forEach(c => {
                    if (c.type === 'UUID') imports.add('UUID');
                    if (c.type === 'Date') imports.add('date');
                    if (c.type === 'DateTime' || c.type === 'Timestamp') imports.add('datetime');
                    if (c.type === 'Decimal') imports.add('Decimal');
                });
                let code = `from pydantic import ${[...imports].join(', ')}\nfrom typing import Optional\nimport uuid\nfrom datetime import date, datetime\nfrom decimal import Decimal\n\nclass ${e}Base(BaseModel):\n`;
                columns.filter(c => !c.pk).forEach(c => {
                    const t = pyTypeMap[c.type] || 'str';
                    code += `    ${c.name}: ${c.nn ? t : 'Optional[' + t + '] = None'}\n`;
                });
                code += `\nclass ${e}Create(${e}Base):\n    pass\n\nclass ${e}Response(${e}Base):\n`;
                columns.filter(c => c.pk).forEach(c => {
                    code += `    ${c.name}: ${pyTypeMap[c.type] || 'str'}\n`;
                });
                code += `\n    class Config:\n        from_attributes = True\n`;
                return code;
            },
            'Router (FastAPI)': () => {
                const e = getEntityName();
                const v = toCamel(e);
                const path = toKebab(getTableName());
                return `from fastapi import APIRouter, Depends, HTTPException\nfrom sqlalchemy.orm import Session\nfrom typing import List\nfrom .models import ${e}\nfrom .schemas import ${e}Create, ${e}Response\nfrom .database import get_db\n\nrouter = APIRouter(prefix="/api/${path}", tags=["${e}"])\n\n@router.get("/", response_model=List[${e}Response])\ndef get_all(db: Session = Depends(get_db)):\n    return db.query(${e}).all()\n\n@router.get("/{id}", response_model=${e}Response)\ndef get_by_id(id: str, db: Session = Depends(get_db)):\n    ${v} = db.query(${e}).filter(${e}.id == id).first()\n    if not ${v}:\n        raise HTTPException(status_code=404, detail="${e} not found")\n    return ${v}\n\n@router.post("/", response_model=${e}Response, status_code=201)\ndef create(data: ${e}Create, db: Session = Depends(get_db)):\n    ${v} = ${e}(**data.model_dump())\n    db.add(${v})\n    db.commit()\n    db.refresh(${v})\n    return ${v}\n\n@router.put("/{id}", response_model=${e}Response)\ndef update(id: str, data: ${e}Create, db: Session = Depends(get_db)):\n    ${v} = db.query(${e}).filter(${e}.id == id).first()\n    if not ${v}:\n        raise HTTPException(status_code=404, detail="${e} not found")\n    for k, v in data.model_dump().items():\n        setattr(${v}, k, v)\n    db.commit()\n    db.refresh(${v})\n    return ${v}\n\n@router.delete("/{id}", status_code=204)\ndef delete(id: str, db: Session = Depends(get_db)):\n    ${v} = db.query(${e}).filter(${e}.id == id).first()\n    if not ${v}:\n        raise HTTPException(status_code=404, detail="${e} not found")\n    db.delete(${v})\n    db.commit()\n`;
            },
        },
        go: {
            'Struct': () => {
                const e = getEntityName();
                let code = `package models\n\nimport (\n\t"time"\n\t"github.com/google/uuid"\n)\n\ntype ${e} struct {\n`;
                columns.forEach(c => {
                    const goType = goTypeMap[c.type] || 'string';
                    const jsonTag = c.name;
                    const dbTag = c.name;
                    code += `\t${toPascal(c.name)} ${goType} \`json:"${jsonTag}" db:"${dbTag}"\`\n`;
                });
                code += '}\n';
                return code;
            },
            'Handler': () => {
                const e = getEntityName();
                const path = toKebab(getTableName());
                return `package handlers\n\nimport (\n\t"net/http"\n\t"github.com/gofiber/fiber/v2"\n)\n\ntype ${e}Handler struct {\n\t// repo *repository.${e}Repository\n}\n\nfunc (h *${e}Handler) Register(app *fiber.App) {\n\tg := app.Group("/api/${path}")\n\tg.Get("/", h.GetAll)\n\tg.Get("/:id", h.GetById)\n\tg.Post("/", h.Create)\n\tg.Put("/:id", h.Update)\n\tg.Delete("/:id", h.Delete)\n}\n\nfunc (h *${e}Handler) GetAll(c *fiber.Ctx) error {\n\t// TODO: implement\n\treturn c.JSON(fiber.Map{"data": []interface{}{}})\n}\n\nfunc (h *${e}Handler) GetById(c *fiber.Ctx) error {\n\tid := c.Params("id")\n\t// TODO: implement\n\treturn c.JSON(fiber.Map{"id": id})\n}\n\nfunc (h *${e}Handler) Create(c *fiber.Ctx) error {\n\t// TODO: implement\n\treturn c.Status(http.StatusCreated).JSON(fiber.Map{"message": "created"})\n}\n\nfunc (h *${e}Handler) Update(c *fiber.Ctx) error {\n\t// TODO: implement\n\treturn c.JSON(fiber.Map{"message": "updated"})\n}\n\nfunc (h *${e}Handler) Delete(c *fiber.Ctx) error {\n\t// TODO: implement\n\treturn c.SendStatus(http.StatusNoContent)\n}\n`;
            },
        },
        node: {
            'Prisma Model': () => {
                const e = getEntityName();
                const prismaMap = { UUID: 'String @default(uuid())', String: 'String', Text: 'String', Integer: 'Int', Long: 'BigInt', Double: 'Float', Decimal: 'Decimal', Boolean: 'Boolean', Date: 'DateTime', DateTime: 'DateTime', Timestamp: 'DateTime', Enum: 'String', JSON: 'Json', Blob: 'Bytes' };
                let code = `model ${e} {\n`;
                columns.forEach(c => {
                    let t = prismaMap[c.type] || 'String';
                    if (c.pk && c.type === 'UUID') t = 'String @id @default(uuid())';
                    else if (c.pk && c.ai) t = 'Int @id @default(autoincrement())';
                    else if (c.pk) t += ' @id';
                    if (c.uq && !c.pk) t += ' @unique';
                    if (!c.nn && !c.pk) t = t.replace(/^(\w+)/, '$1?');
                    if (c.def && !c.pk) t += ` @default(${c.def})`;
                    if (c.type === 'DateTime' && c.name.includes('created')) t += ' @default(now())';
                    if (c.type === 'DateTime' && c.name.includes('updated')) t += ' @updatedAt';
                    code += `    ${toCamel(c.name)} ${t}\n`;
                });
                code += `\n    @@map("${getTableName()}")\n}\n`;
                return code;
            },
            'Controller (Express)': () => {
                const e = getEntityName();
                const v = toCamel(e);
                const path = toKebab(getTableName());
                return `import { Router, Request, Response } from 'express';\nimport { PrismaClient } from '@prisma/client';\n\nconst router = Router();\nconst prisma = new PrismaClient();\n\n// GET /api/${path}\nrouter.get('/', async (req: Request, res: Response) => {\n    const ${v}s = await prisma.${v}.findMany();\n    res.json(${v}s);\n});\n\n// GET /api/${path}/:id\nrouter.get('/:id', async (req: Request, res: Response) => {\n    const ${v} = await prisma.${v}.findUnique({ where: { id: req.params.id } });\n    if (!${v}) return res.status(404).json({ error: '${e} not found' });\n    res.json(${v});\n});\n\n// POST /api/${path}\nrouter.post('/', async (req: Request, res: Response) => {\n    const ${v} = await prisma.${v}.create({ data: req.body });\n    res.status(201).json(${v});\n});\n\n// PUT /api/${path}/:id\nrouter.put('/:id', async (req: Request, res: Response) => {\n    const ${v} = await prisma.${v}.update({ where: { id: req.params.id }, data: req.body });\n    res.json(${v});\n});\n\n// DELETE /api/${path}/:id\nrouter.delete('/:id', async (req: Request, res: Response) => {\n    await prisma.${v}.delete({ where: { id: req.params.id } });\n    res.status(204).send();\n});\n\nexport default router;\n`;
            },
        },
        typescript: {
            'Interface': () => {
                const e = getEntityName();
                let code = `export interface ${e} {\n`;
                columns.forEach(c => {
                    const opt = c.nn ? '' : '?';
                    code += `    ${toCamel(c.name)}${opt}: ${tsTypeMap[c.type] || 'string'};\n`;
                });
                code += `}\n\nexport interface Create${e}DTO {\n`;
                columns.filter(c => !c.pk).forEach(c => {
                    const opt = c.nn ? '' : '?';
                    code += `    ${toCamel(c.name)}${opt}: ${tsTypeMap[c.type] || 'string'};\n`;
                });
                code += '}\n';
                return code;
            },
        },
        angular: {
            'Model': () => {
                const e = getEntityName();
                let code = `export interface ${e} {\n`;
                columns.forEach(c => {
                    const opt = c.nn ? '' : '?';
                    code += `    ${toCamel(c.name)}${opt}: ${tsTypeMap[c.type] || 'string'};\n`;
                });
                code += '}\n';
                return code;
            },
            'Service': () => {
                const e = getEntityName();
                const v = toCamel(e);
                const path = toKebab(getTableName());
                return `import { Injectable, inject } from '@angular/core';\nimport { HttpClient } from '@angular/common/http';\nimport { Observable } from 'rxjs';\nimport { ${e} } from './${toKebab(singular(getTableName()))}.model';\n\n@Injectable({ providedIn: 'root' })\nexport class ${e}Service {\n    private http = inject(HttpClient);\n    private apiUrl = '/api/${path}';\n\n    getAll(): Observable<${e}[]> {\n        return this.http.get<${e}[]>(this.apiUrl);\n    }\n\n    getById(id: string): Observable<${e}> {\n        return this.http.get<${e}>(\`\${this.apiUrl}/\${id}\`);\n    }\n\n    create(data: Partial<${e}>): Observable<${e}> {\n        return this.http.post<${e}>(this.apiUrl, data);\n    }\n\n    update(id: string, data: Partial<${e}>): Observable<${e}> {\n        return this.http.put<${e}>(\`\${this.apiUrl}/\${id}\`, data);\n    }\n\n    delete(id: string): Observable<void> {\n        return this.http.delete<void>(\`\${this.apiUrl}/\${id}\`);\n    }\n}\n`;
            },
            'Component': () => {
                const e = getEntityName();
                const v = toCamel(e);
                const tag = toKebab(singular(getTableName()));
                return `import { Component, inject, OnInit, signal } from '@angular/core';\nimport { CommonModule } from '@angular/common';\nimport { FormsModule } from '@angular/forms';\nimport { ${e}Service } from './${tag}.service';\nimport { ${e} } from './${tag}.model';\n\n@Component({\n    selector: 'app-${tag}-list',\n    standalone: true,\n    imports: [CommonModule, FormsModule],\n    template: \`\n        <div class="container mt-3">\n            <div class="d-flex justify-content-between align-items-center mb-3">\n                <h4>${e} List</h4>\n                <button class="btn btn-primary" (click)="showForm = !showForm">Add ${e}</button>\n            </div>\n\n            <table class="table table-striped">\n                <thead>\n                    <tr>\n${columns.map(c => `                        <th>${toPascal(c.name)}</th>`).join('\n')}\n                        <th>Actions</th>\n                    </tr>\n                </thead>\n                <tbody>\n                    @for (item of items(); track item.${toCamel(columns[0]?.name || 'id')}) {\n                        <tr>\n${columns.map(c => `                            <td>{{ item.${toCamel(c.name)} }}</td>`).join('\n')}\n                            <td>\n                                <button class="btn btn-sm btn-outline-primary me-1" (click)="edit(item)">Edit</button>\n                                <button class="btn btn-sm btn-outline-danger" (click)="delete(item)">Delete</button>\n                            </td>\n                        </tr>\n                    }\n                </tbody>\n            </table>\n        </div>\n    \`\n})\nexport class ${e}ListComponent implements OnInit {\n    private ${v}Service = inject(${e}Service);\n    items = signal<${e}[]>([]);\n    showForm = false;\n\n    ngOnInit() {\n        this.load();\n    }\n\n    load() {\n        this.${v}Service.getAll().subscribe(data => this.items.set(data));\n    }\n\n    edit(item: ${e}) {\n        // TODO: implement edit\n    }\n\n    delete(item: ${e}) {\n        if (confirm('Delete this ${v}?')) {\n            this.${v}Service.delete(item.${toCamel(columns.find(c => c.pk)?.name || 'id')}).subscribe(() => this.load());\n        }\n    }\n}\n`;
            },
        },
        react: {
            'Types': () => generators.typescript['Interface'](),
            'Hook': () => {
                const e = getEntityName();
                const v = toCamel(e);
                const path = toKebab(getTableName());
                return `import { useState, useEffect, useCallback } from 'react';\nimport { ${e} } from './types';\n\nconst API_URL = '/api/${path}';\n\nexport function use${e}s() {\n    const [${v}s, set${e}s] = useState<${e}[]>([]);\n    const [loading, setLoading] = useState(false);\n    const [error, setError] = useState<string | null>(null);\n\n    const fetchAll = useCallback(async () => {\n        setLoading(true);\n        try {\n            const res = await fetch(API_URL);\n            const data = await res.json();\n            set${e}s(data);\n        } catch (err) {\n            setError((err as Error).message);\n        } finally {\n            setLoading(false);\n        }\n    }, []);\n\n    const create = async (data: Partial<${e}>) => {\n        const res = await fetch(API_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });\n        const created = await res.json();\n        set${e}s(prev => [...prev, created]);\n        return created;\n    };\n\n    const update = async (id: string, data: Partial<${e}>) => {\n        const res = await fetch(\`\${API_URL}/\${id}\`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });\n        const updated = await res.json();\n        set${e}s(prev => prev.map(item => item.id === id ? updated : item));\n        return updated;\n    };\n\n    const remove = async (id: string) => {\n        await fetch(\`\${API_URL}/\${id}\`, { method: 'DELETE' });\n        set${e}s(prev => prev.filter(item => item.id !== id));\n    };\n\n    useEffect(() => { fetchAll(); }, [fetchAll]);\n\n    return { ${v}s, loading, error, fetchAll, create, update, remove };\n}\n`;
            },
            'Component': () => {
                const e = getEntityName();
                const v = toCamel(e);
                return `'use client';\nimport { use${e}s } from './use${e}s';\nimport { ${e} } from './types';\nimport { useState } from 'react';\n\nexport default function ${e}List() {\n    const { ${v}s, loading, remove } = use${e}s();\n\n    if (loading) return <div className="text-center p-4">Loading...</div>;\n\n    return (\n        <div className="container mx-auto p-4">\n            <div className="flex justify-between items-center mb-4">\n                <h2 className="text-2xl font-bold">${e} List</h2>\n                <button className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600">\n                    Add ${e}\n                </button>\n            </div>\n\n            <div className="overflow-x-auto">\n                <table className="min-w-full bg-white border border-gray-200 rounded-lg">\n                    <thead className="bg-gray-50">\n                        <tr>\n${columns.map(c => `                            <th className="px-4 py-2 text-left text-sm font-semibold text-gray-600">${toPascal(c.name)}</th>`).join('\n')}\n                            <th className="px-4 py-2 text-left text-sm font-semibold text-gray-600">Actions</th>\n                        </tr>\n                    </thead>\n                    <tbody>\n                        {${v}s.map((item) => (\n                            <tr key={item.${toCamel(columns.find(c => c.pk)?.name || 'id')}} className="border-t hover:bg-gray-50">\n${columns.map(c => `                                <td className="px-4 py-2 text-sm">{String(item.${toCamel(c.name)} ?? '')}</td>`).join('\n')}\n                                <td className="px-4 py-2 text-sm space-x-2">\n                                    <button className="text-blue-500 hover:underline">Edit</button>\n                                    <button className="text-red-500 hover:underline" onClick={() => remove(String(item.${toCamel(columns.find(c => c.pk)?.name || 'id')}))}>Delete</button>\n                                </td>\n                            </tr>\n                        ))}\n                    </tbody>\n                </table>\n            </div>\n        </div>\n    );\n}\n`;
            },
        },
        nextjs: {
            'Types': () => generators.typescript['Interface'](),
            'API Route': () => {
                const e = getEntityName();
                const v = toCamel(e);
                return `import { NextRequest, NextResponse } from 'next/server';\nimport { prisma } from '@/lib/prisma';\n\n// GET /api/${toKebab(getTableName())}\nexport async function GET() {\n    const ${v}s = await prisma.${v}.findMany();\n    return NextResponse.json(${v}s);\n}\n\n// POST /api/${toKebab(getTableName())}\nexport async function POST(request: NextRequest) {\n    const body = await request.json();\n    const ${v} = await prisma.${v}.create({ data: body });\n    return NextResponse.json(${v}, { status: 201 });\n}\n`;
            },
            'API Route [id]': () => {
                const e = getEntityName();
                const v = toCamel(e);
                return `import { NextRequest, NextResponse } from 'next/server';\nimport { prisma } from '@/lib/prisma';\n\ntype Params = { params: { id: string } };\n\n// GET /api/${toKebab(getTableName())}/[id]\nexport async function GET(request: NextRequest, { params }: Params) {\n    const ${v} = await prisma.${v}.findUnique({ where: { id: params.id } });\n    if (!${v}) return NextResponse.json({ error: 'Not found' }, { status: 404 });\n    return NextResponse.json(${v});\n}\n\n// PUT /api/${toKebab(getTableName())}/[id]\nexport async function PUT(request: NextRequest, { params }: Params) {\n    const body = await request.json();\n    const ${v} = await prisma.${v}.update({ where: { id: params.id }, data: body });\n    return NextResponse.json(${v});\n}\n\n// DELETE /api/${toKebab(getTableName())}/[id]\nexport async function DELETE(request: NextRequest, { params }: Params) {\n    await prisma.${v}.delete({ where: { id: params.id } });\n    return new NextResponse(null, { status: 204 });\n}\n`;
            },
            'Page Component': () => generators.react['Component'](),
        },
    };

    // ── Import SQL ──
    document.getElementById('importSqlBtn').addEventListener('click', () => new bootstrap.Modal(document.getElementById('importSqlModal')).show());
    document.getElementById('importSqlConfirm').addEventListener('click', function () {
        const sql = document.getElementById('importSqlText').value;
        parseSQLCreate(sql);
        bootstrap.Modal.getInstance(document.getElementById('importSqlModal')).hide();
    });

    function parseSQLCreate(sql) {
        const tableMatch = sql.match(/CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?["`]?(\w+)["`]?\s*\(/i);
        if (tableMatch) document.getElementById('tableName').value = tableMatch[1];

        const body = sql.match(/\(([^]*)\)/);
        if (!body) return;

        columns = [];
        const lines = body[1].split(',').map(l => l.trim()).filter(l => l && !l.match(/^\s*(PRIMARY|FOREIGN|UNIQUE|INDEX|KEY|CONSTRAINT)/i));
        lines.forEach(line => {
            const m = line.match(/^["`]?(\w+)["`]?\s+(\w+)(?:\((\d+)(?:,\d+)?\))?(.*)$/i);
            if (!m) return;
            const [, name, rawType, len, rest] = m;
            const typeMap = { 'uuid': 'UUID', 'varchar': 'String', 'char': 'String', 'text': 'Text', 'int': 'Integer', 'integer': 'Integer', 'bigint': 'Long', 'serial': 'Integer', 'bigserial': 'Long', 'float': 'Double', 'double': 'Double', 'decimal': 'Decimal', 'numeric': 'Decimal', 'boolean': 'Boolean', 'bool': 'Boolean', 'tinyint': 'Boolean', 'date': 'Date', 'datetime': 'DateTime', 'timestamp': 'Timestamp', 'json': 'JSON', 'jsonb': 'JSON', 'bytea': 'Blob', 'blob': 'Blob' };
            const type = typeMap[rawType.toLowerCase()] || 'String';
            const nn = /NOT\s+NULL/i.test(rest);
            const uq = /UNIQUE/i.test(rest);
            const pk = /PRIMARY\s+KEY/i.test(rest);
            const ai = /AUTO_INCREMENT|SERIAL/i.test(line);
            const defMatch = rest.match(/DEFAULT\s+(.+?)(?:\s|,|$)/i);
            columns.push({ name, type, length: len || '', pk, nn: nn || pk, uq, ai, def: defMatch ? defMatch[1] : '', ref: '' });
        });

        // Check for PRIMARY KEY constraint
        const pkMatch = body[1].match(/PRIMARY\s+KEY\s*\(([^)]+)\)/i);
        if (pkMatch) {
            const pkCols = pkMatch[1].split(',').map(c => c.trim().replace(/["`]/g, ''));
            pkCols.forEach(pk => {
                const col = columns.find(c => c.name === pk);
                if (col) { col.pk = true; col.nn = true; }
            });
        }

        renderSchema();
    }

    // ── Import JSON ──
    document.getElementById('importJsonBtn').addEventListener('click', () => new bootstrap.Modal(document.getElementById('importJsonModal')).show());
    document.getElementById('importJsonConfirm').addEventListener('click', function () {
        const json = document.getElementById('importJsonText').value;
        try {
            const obj = JSON.parse(json);
            columns = [];
            for (const [key, val] of Object.entries(obj)) {
                let type = 'String';
                if (typeof val === 'number') type = Number.isInteger(val) ? 'Integer' : 'Double';
                else if (typeof val === 'boolean') type = 'Boolean';
                else if (typeof val === 'string') {
                    if (/^\d{4}-\d{2}-\d{2}T/.test(val)) type = 'DateTime';
                    else if (/^\d{4}-\d{2}-\d{2}$/.test(val)) type = 'Date';
                    else if (/^[0-9a-f]{8}-[0-9a-f]{4}/.test(val)) type = 'UUID';
                    else type = val.length > 255 ? 'Text' : 'String';
                }
                else if (typeof val === 'object') type = 'JSON';
                const isId = key === 'id' || key.endsWith('_id');
                columns.push({ name: toSnake(key), type, length: type === 'String' ? '255' : '', pk: key === 'id', nn: key === 'id', uq: false, ai: false, def: '', ref: '' });
            }
            renderSchema();
            bootstrap.Modal.getInstance(document.getElementById('importJsonModal')).hide();
        } catch (e) {
            alert('Invalid JSON: ' + e.message);
        }
    });

    // ── Export Schema ──
    document.getElementById('exportSchemaBtn').addEventListener('click', function () {
        const data = { table: getTableName(), package: document.getElementById('packageName').value, columns };
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const a = document.createElement('a'); a.download = getTableName() + '-schema.json'; a.href = URL.createObjectURL(blob); a.click();
    });

    // Clear
    document.getElementById('clearBtn').addEventListener('click', function () {
        columns = [];
        generated = {};
        outputArea.textContent = 'Click "Generate" to create code from your schema.';
        outputTabs.innerHTML = '';
        renderSchema();
    });

    // Ctrl+Enter to generate
    document.addEventListener('keydown', function (e) {
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); generate(); }
    });

    function esc(s) { const d = document.createElement('div'); d.textContent = s || ''; return d.innerHTML; }

    // ── Samples ──
    const C = (name, type, opts = {}) => ({ name, type, length: opts.len || '', pk: !!opts.pk, nn: !!opts.nn, uq: !!opts.uq, ai: !!opts.ai, def: opts.def || '', ref: opts.ref || '' });

    const sampleSchemas = {
        users: { table: 'users', cols: [
            C('id', 'UUID', { pk: true, nn: true, def: 'gen_random_uuid()' }),
            C('username', 'String', { len: '50', nn: true, uq: true }),
            C('email', 'String', { len: '255', nn: true, uq: true }),
            C('password_hash', 'String', { len: '255', nn: true }),
            C('full_name', 'String', { len: '200' }),
            C('avatar_url', 'String', { len: '500' }),
            C('phone', 'String', { len: '20' }),
            C('role', 'String', { len: '50', nn: true, def: "'user'" }),
            C('is_active', 'Boolean', { nn: true, def: 'true' }),
            C('email_verified_at', 'Timestamp'),
            C('last_login_at', 'Timestamp'),
            C('created_at', 'Timestamp', { nn: true, def: 'NOW()' }),
            C('updated_at', 'Timestamp', { nn: true, def: 'NOW()' }),
        ]},
        products: { table: 'products', cols: [
            C('id', 'UUID', { pk: true, nn: true, def: 'gen_random_uuid()' }),
            C('sku', 'String', { len: '50', nn: true, uq: true }),
            C('name', 'String', { len: '300', nn: true }),
            C('slug', 'String', { len: '300', nn: true, uq: true }),
            C('description', 'Text'),
            C('price', 'Decimal', { len: '12,2', nn: true }),
            C('compare_at_price', 'Decimal', { len: '12,2' }),
            C('cost_price', 'Decimal', { len: '12,2' }),
            C('currency', 'String', { len: '3', nn: true, def: "'USD'" }),
            C('stock_quantity', 'Integer', { nn: true, def: '0' }),
            C('low_stock_threshold', 'Integer', { def: '10' }),
            C('weight', 'Double'),
            C('category_id', 'UUID', { ref: 'categories.id' }),
            C('brand_id', 'UUID', { ref: 'brands.id' }),
            C('image_url', 'String', { len: '500' }),
            C('is_active', 'Boolean', { nn: true, def: 'true' }),
            C('is_featured', 'Boolean', { nn: true, def: 'false' }),
            C('meta_title', 'String', { len: '200' }),
            C('meta_description', 'String', { len: '500' }),
            C('created_at', 'Timestamp', { nn: true, def: 'NOW()' }),
            C('updated_at', 'Timestamp', { nn: true, def: 'NOW()' }),
        ]},
        orders: { table: 'orders', cols: [
            C('id', 'UUID', { pk: true, nn: true, def: 'gen_random_uuid()' }),
            C('order_number', 'String', { len: '50', nn: true, uq: true }),
            C('user_id', 'UUID', { nn: true, ref: 'users.id' }),
            C('status', 'String', { len: '30', nn: true, def: "'pending'" }),
            C('subtotal', 'Decimal', { len: '12,2', nn: true }),
            C('discount_amount', 'Decimal', { len: '12,2', def: '0' }),
            C('shipping_cost', 'Decimal', { len: '12,2', def: '0' }),
            C('tax_amount', 'Decimal', { len: '12,2', def: '0' }),
            C('total_amount', 'Decimal', { len: '12,2', nn: true }),
            C('currency', 'String', { len: '3', nn: true, def: "'USD'" }),
            C('payment_method', 'String', { len: '50' }),
            C('payment_status', 'String', { len: '30', def: "'unpaid'" }),
            C('shipping_name', 'String', { len: '200' }),
            C('shipping_address', 'Text'),
            C('shipping_city', 'String', { len: '100' }),
            C('shipping_state', 'String', { len: '100' }),
            C('shipping_zip', 'String', { len: '20' }),
            C('shipping_country', 'String', { len: '2' }),
            C('shipping_phone', 'String', { len: '20' }),
            C('tracking_number', 'String', { len: '100' }),
            C('notes', 'Text'),
            C('shipped_at', 'Timestamp'),
            C('delivered_at', 'Timestamp'),
            C('cancelled_at', 'Timestamp'),
            C('created_at', 'Timestamp', { nn: true, def: 'NOW()' }),
            C('updated_at', 'Timestamp', { nn: true, def: 'NOW()' }),
        ]},
        posts: { table: 'posts', cols: [
            C('id', 'UUID', { pk: true, nn: true, def: 'gen_random_uuid()' }),
            C('title', 'String', { len: '300', nn: true }),
            C('slug', 'String', { len: '300', nn: true, uq: true }),
            C('excerpt', 'String', { len: '500' }),
            C('content', 'Text', { nn: true }),
            C('cover_image_url', 'String', { len: '500' }),
            C('author_id', 'UUID', { nn: true, ref: 'users.id' }),
            C('category_id', 'UUID', { ref: 'categories.id' }),
            C('status', 'String', { len: '20', nn: true, def: "'draft'" }),
            C('is_featured', 'Boolean', { nn: true, def: 'false' }),
            C('view_count', 'Integer', { nn: true, def: '0' }),
            C('like_count', 'Integer', { nn: true, def: '0' }),
            C('meta_title', 'String', { len: '200' }),
            C('meta_description', 'String', { len: '500' }),
            C('published_at', 'Timestamp'),
            C('created_at', 'Timestamp', { nn: true, def: 'NOW()' }),
            C('updated_at', 'Timestamp', { nn: true, def: 'NOW()' }),
        ]},
        employees: { table: 'employees', cols: [
            C('id', 'UUID', { pk: true, nn: true, def: 'gen_random_uuid()' }),
            C('employee_number', 'String', { len: '20', nn: true, uq: true }),
            C('first_name', 'String', { len: '100', nn: true }),
            C('last_name', 'String', { len: '100', nn: true }),
            C('email', 'String', { len: '255', nn: true, uq: true }),
            C('phone', 'String', { len: '20' }),
            C('date_of_birth', 'Date'),
            C('gender', 'String', { len: '10' }),
            C('address', 'Text'),
            C('city', 'String', { len: '100' }),
            C('state', 'String', { len: '100' }),
            C('zip_code', 'String', { len: '20' }),
            C('country', 'String', { len: '2', def: "'ID'" }),
            C('department_id', 'UUID', { ref: 'departments.id' }),
            C('position_id', 'UUID', { ref: 'positions.id' }),
            C('manager_id', 'UUID', { ref: 'employees.id' }),
            C('hire_date', 'Date', { nn: true }),
            C('salary', 'Decimal', { len: '15,2' }),
            C('employment_type', 'String', { len: '20', nn: true, def: "'full_time'" }),
            C('status', 'String', { len: '20', nn: true, def: "'active'" }),
            C('emergency_contact_name', 'String', { len: '200' }),
            C('emergency_contact_phone', 'String', { len: '20' }),
            C('terminated_at', 'Date'),
            C('created_at', 'Timestamp', { nn: true, def: 'NOW()' }),
            C('updated_at', 'Timestamp', { nn: true, def: 'NOW()' }),
        ]},
        invoices: { table: 'invoices', cols: [
            C('id', 'UUID', { pk: true, nn: true, def: 'gen_random_uuid()' }),
            C('invoice_number', 'String', { len: '50', nn: true, uq: true }),
            C('customer_id', 'UUID', { nn: true, ref: 'customers.id' }),
            C('order_id', 'UUID', { ref: 'orders.id' }),
            C('issue_date', 'Date', { nn: true }),
            C('due_date', 'Date', { nn: true }),
            C('subtotal', 'Decimal', { len: '15,2', nn: true }),
            C('tax_rate', 'Decimal', { len: '5,2', def: '0' }),
            C('tax_amount', 'Decimal', { len: '15,2', def: '0' }),
            C('discount_amount', 'Decimal', { len: '15,2', def: '0' }),
            C('total_amount', 'Decimal', { len: '15,2', nn: true }),
            C('currency', 'String', { len: '3', nn: true, def: "'USD'" }),
            C('status', 'String', { len: '20', nn: true, def: "'draft'" }),
            C('payment_method', 'String', { len: '50' }),
            C('payment_reference', 'String', { len: '100' }),
            C('notes', 'Text'),
            C('paid_at', 'Timestamp'),
            C('cancelled_at', 'Timestamp'),
            C('created_at', 'Timestamp', { nn: true, def: 'NOW()' }),
            C('updated_at', 'Timestamp', { nn: true, def: 'NOW()' }),
        ]},
    };

    document.getElementById('samplesMenu').addEventListener('click', function (e) {
        const item = e.target.closest('[data-sample]');
        if (!item) return;
        e.preventDefault();
        const sample = sampleSchemas[item.dataset.sample];
        if (!sample) return;
        document.getElementById('tableName').value = sample.table;
        columns = sample.cols.map(c => ({ ...c }));
        renderSchema();
        generate();
    });

    // ── Init with sample ──
    columns = [
        { name: 'id', type: 'UUID', length: '', pk: true, nn: true, uq: false, ai: false, def: 'gen_random_uuid()', ref: '' },
        { name: 'name', type: 'String', length: '200', pk: false, nn: true, uq: false, ai: false, def: '', ref: '' },
        { name: 'email', type: 'String', length: '255', pk: false, nn: true, uq: true, ai: false, def: '', ref: '' },
        { name: 'age', type: 'Integer', length: '', pk: false, nn: false, uq: false, ai: false, def: '', ref: '' },
        { name: 'is_active', type: 'Boolean', length: '', pk: false, nn: true, uq: false, ai: false, def: 'true', ref: '' },
        { name: 'created_at', type: 'Timestamp', length: '', pk: false, nn: true, uq: false, ai: false, def: 'NOW()', ref: '' },
    ];
    renderSchema();
});
