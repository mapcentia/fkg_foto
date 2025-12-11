import {createRoot} from 'react-dom/client';
import React, {useEffect, useRef, useState} from 'react';
import FileUploadWidget from "./FileUploadWidget";
import {Theme} from "@rjsf/bootstrap-4";
import {withTheme} from "@rjsf/core";
import validator from "@rjsf/validator-ajv8";

let utils;
let backboneEvents;
let session;

const widgets = {'fileupload': FileUploadWidget};

const Theme5 = {
    ...Theme,
    widgets: {...Theme.widgets}
}

const Form = withTheme(Theme5);

const schema = {
    type: "object",
    properties: {
        file: {
            type: "string",
            title: "Upload foto",
            widget: "fileupload"
        }
    },
    required: ["file"]
}

const uiSchema = {
    file: {
        "ui:widget": "fileupload"
    }
}

let sqlQuery;


function Upload(props) {
    const formRef = useRef(null);

    const onSubmit = async (e) => {
        console.log(e);
        try {
            const response = await fetch('/api/extension/fkgupload', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(e.formData),
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.message || `Upload failed with status: ${response.status}`);
            }

            const data = await response.json();
            if (window.vidiConfig.extensionConfig?.fkg_foto?.imageDirectAttach) {
                await window.FKGUpload.attach(data.image.split('.')[0]);
                await window.FKGUpload.refresh();
            }

            // Clear the form after successful upload
            if (formRef.current) {
                formRef.current.setState({formData: {}});
            }
            console.log('Success:', data);
        } catch (error) {
            console.error('Error:', error);
            alert(`Error: ${error.message}`);
        }
    }

    const transformErrors = (errors, uiSchema) => {
        return errors.map((error) => {
            if (error.name === 'required') {
                error.message = __(`Required`);
            }
            return error;
        });
    }

    return <Form
        ref={formRef}
        validator={validator}
        className="feature-attribute-editing-form"
        schema={schema} noHtml5Validate
        uiSchema={uiSchema}
        widgets={widgets}
        onSubmit={onSubmit}
        transformErrors={transformErrors}
    >
        <div className="buttons">
            <button type="submit"
                    className="btn btn btn-success mb-2 mt-2 w-100">{__("Submit")}</button>
        </div>
    </Form>;
}

// Helper: safely enable Bootstrap tooltips if Bootstrap JS is present
function enableTooltips() {
    try {
        const bootstrap = window.bootstrap;
        if (!bootstrap || !bootstrap.Tooltip) return;
        const tooltipTriggerList = Array.prototype.slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
        tooltipTriggerList.forEach((el) => new bootstrap.Tooltip(el));
    } catch (e) {
        // ignore if bootstrap is not available
    }
}

function PhotoAttachManager() {
    const defaults = {
        facilitetId: '',
        theme: ''
    };

    const [facilitetId, setFacilitetId] = useState(defaults.facilitetId);
    const [theme, setTheme] = useState(defaults.theme);

    const [attached, setAttached] = useState([]); // array of [e, isPri, forbindelsesId]
    const [detached, setDetached] = useState([]); // array of e
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const baseUrl = '/api/extensions/fkgupload/api/process';

    async function getDetached() {
        if (!facilitetId) return;
        const url = `${baseUrl}/7901/${encodeURIComponent(facilitetId)}`;
        const res = await fetch(url, {headers: {'Accept': 'application/json'}});
        if (!res.ok) throw new Error(`Failed to fetch detached (${res.status})`);
        const data = await res.json();
        setDetached(Array.isArray(data?.data) ? data.data : []);
    }

    async function getAttached() {
        if (!facilitetId) return;
        const url = `${baseUrl}/7900/${encodeURIComponent(facilitetId)}`;
        const res = await fetch(url, {headers: {'Accept': 'application/json'}});
        if (!res.ok) throw new Error(`Failed to fetch attached (${res.status})`);
        const data = await res.json();
        setAttached(Array.isArray(data?.data) ? data.data : []);
    }

    async function attach(photo) {
        const res = await fetch(`${baseUrl}/7900`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json; charset=utf-8'},
            body: JSON.stringify({
                "tema": theme,
                "foto_objek": facilitetId,
                "foto_lokat": photo
            })
        });
        if (!res.ok) throw new Error('Attach failed');
        await update();
    }

    async function detach(objekt_id) {
        const res = await fetch(`${baseUrl}/7900/${encodeURIComponent(objekt_id)}`, {
            method: 'DELETE',
            headers: {'Content-Type': 'application/json; charset=utf-8'}
        });
        if (!res.ok) throw new Error('Detach failed');
        await update();
    }

    async function setPrimary(forbindelsesId) {
        const res = await fetch(`${baseUrl}/7900`, {
            method: 'PUT',
            headers: {'Content-Type': 'application/json; charset=utf-8'},
            body: JSON.stringify({
                "objekt_id": facilitetId,
                "objekt_id_7900": forbindelsesId
            })
        });
        if (!res.ok) throw new Error('Set primary failed');
        await update();
    }

    async function update() {
        if (!facilitetId) return;
        setLoading(true);
        setError(null);
        try {
            await Promise.all([getAttached(), getDetached()]);
        } catch (e) {
            console.error(e);
            setError(e.message || 'Unknown error');
            // try { alert(); } catch (_) { /* keep parity with original */ }
        } finally {
            setLoading(false);
            // Re-enable tooltips after DOM updates
            setTimeout(enableTooltips, 0);
        }
    }

    // Expose global API to set context and refresh
    useEffect(() => {
        const api = {
            setContext: ({facilitetId: fid, theme: thm} = {}) => {
                if (typeof fid !== 'undefined') setFacilitetId(String(fid));
                if (typeof thm !== 'undefined') setTheme(String(thm));
            },
            refresh: () => update(),
            // expose actions too (optional)
            attach: (photo) => attach(photo),
            detach: (objekt_id) => detach(objekt_id),
            setPrimary: (forbindelsesId) => setPrimary(forbindelsesId)
        };
        window.FKGUpload = api;
        return () => {
            if (window.FKGUpload === api) {
                delete window.FKGUpload;
            }
        };
    }, [facilitetId, theme]);

    // Initial load
    useEffect(() => {
        update();
    }, [facilitetId, theme]);

    return (
        <div className="container-fluid flex-grow-1">
            <ul className="nav nav-pills" id="myTab" role="tablist">
                <li className="nav-item" role="presentation">
                    <button className="nav-link active" id="attached-tab" data-bs-toggle="tab"
                            data-bs-target="#attached" type="button" role="tab" aria-controls="attached"
                            aria-selected="true">Tilknyttede
                    </button>
                </li>
                <li className="nav-item" role="presentation">
                    <button className="nav-link" id="detached-tab" data-bs-toggle="tab" data-bs-target="#detached"
                            type="button" role="tab" aria-controls="detached" aria-selected="false">Ikke tilknyttede
                    </button>
                </li>
            </ul>
            <div className="tab-content" id="myTabContent">
                <div className="tab-pane fade show active" id="attached" role="tabpanel" aria-labelledby="attached-tab">
                    <div className="container-fluid">
                        <div className="row row-cols-2" id="attached-container">
                            {loading && attached.length === 0 && (
                                <div className="col gy-2">Indlæser...</div>
                            )}
                            {attached.map((o) => {
                                const e = o[0];
                                const isPri = o[1];
                                const forbindelsesId = o[2];
                                const id = `detach_${e}`;
                                const idp = `primary_${e}`;
                                const imgSrc = `https://mapcentia-www.s3-eu-west-1.amazonaws.com/fkg/360/${e}.jpg`;
                                return (
                                    <div className="col gy-2" key={`attached_${e}`}>
                                        <div className="card" style={{width: '100%', position: 'relative'}}>
                                            <img style={{width: '100%', height: '170px', objectFit: 'cover'}}
                                                 src={imgSrc} className="card-img-top" alt="..."/>
                                            <div style={{
                                                position: 'absolute',
                                                right: '1px',
                                                top: '1px',
                                                width: '23px',
                                                height: '23px',
                                                backgroundColor: 'white'
                                            }}>
                                                <i data-bs-toggle="tooltip" data-bs-placement="left"
                                                   title="Sæt som primær foto"
                                                   className={`bi-star${(isPri === 1 ? '-fill' : '')}`} style={{
                                                    color: 'gold',
                                                    position: 'absolute',
                                                    right: '3px',
                                                    top: '3px',
                                                    cursor: 'pointer'
                                                }} id={idp} onClick={() => setPrimary(forbindelsesId)}></i>
                                            </div>
                                            <div className="card-body" style={{alignSelf: 'center'}}>
                                                <button id={id} className="btn btn btn-outline-danger btn-sm"
                                                        onClick={() => detach(forbindelsesId)}>Slet tilknyt
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
                <div className="tab-pane fade" id="detached" role="tabpanel" aria-labelledby="detached-tab">
                    <div className="container-fluid">
                        <div className="row row-cols-2" id="detached-container">
                            {loading && detached.length === 0 && (
                                <div className="col gy-2">Indlæser...</div>
                            )}
                            {detached.map((e) => {
                                const id = `attach_${e}`;
                                const imgSrc = `https://mapcentia-www.s3-eu-west-1.amazonaws.com/fkg/360/${e}.jpg`;
                                return (
                                    <div className="col gy-2" key={`detached_${e}`}>
                                        <div className="card" style={{width: '100%'}}>
                                            <img style={{width: '100%', height: '170px', objectFit: 'cover'}}
                                                 src={imgSrc} className="card-img-top" alt="..."/>
                                            <div className="card-body" style={{alignSelf: 'center'}}>
                                                <button id={id} className="btn btn-outline-success btn-sm"
                                                        onClick={() => attach(e)}>Tilknyt
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            </div>
            {error && (
                <div className="alert alert-danger mt-2" role="alert">{error}</div>
            )}
        </div>
    );
}

module.exports = module.exports = {

    set: function (o) {
        utils = o.utils;
        backboneEvents = o.backboneEvents;
        session = o.extensions.session.index;
        sqlQuery = o.sqlQuery;
    },

    init: function () {
        const me = this;
        backboneEvents.get().on("feature:selected", (feature) => {
            try {
                window.FKGUpload.setContext({
                    facilitetId: feature.feature.properties.objekt_id,
                    theme: feature.feature.properties.temanavn
                });
            } catch (e) {
                // ignore if window.FKGUpload is not available
            }
        })

        backboneEvents.get().on(`session:authChange`, c => {
            if (c) {
                this.create();
            } else {
                this.remove();
            }
        });

        // Listen to arrival of edit tools
        $(document).arrive('.feature-info-accordion-body .gc2-edit-tools', {
            existing: true
        }, function () {
            const buttonHtml = `
                <button id="" class="btn btn-outline-secondary w-100 offcanvasFkgUpploadControlBtn" type="button">
                   <i class="bi bi-camera"></i> Tilknyt fotos
                </button>`
            $(this).append(buttonHtml);
            me.remove();
            me.create();
        });
    },

    remove: function () {
        const offcanvasElement = document.getElementById('offcanvas-fkgupload-start');
        if (offcanvasElement) {
            offcanvasElement.remove();
        }
    },

    create: function () {
        const offcanvasHtml = `<div class="offcanvas offcanvas-start" data-bs-backdrop="false" tabindex="-1" id="offcanvas-fkgupload-start"
                                 style="z-index: 999993">
                                <div class="offcanvas-header">
                                    <h5 class="offcanvas-title">Tilknyt fotos</h5>
                                    <button type="button" class="btn-close" data-bs-dismiss="offcanvas" aria-label="Close"></button>
                                </div>
                                <div class="offcanvas-body"></div>
                            </div>`


        const embedTarget = document.querySelector('.fade-then-dragging.embed');
        if (!embedTarget) {
            console.error('Target element .fade-then-dragging.embed not found');
            return;
        }

        const navTarget = document.querySelector('#navbarSupportedContent .supported-content');
        if (!navTarget) {
            console.error('Target element #navbarSupportedContent .supported-content not found');
            return;
        }

        embedTarget.insertAdjacentHTML('beforebegin', offcanvasHtml);

        const offcanvasElement = document.getElementById('offcanvas-fkgupload-start');
        if (!offcanvasElement) {
            console.error('Failed to create offcanvas element');
            return;
        }

        const offcanvas = new bootstrap.Offcanvas('#offcanvas-fkgupload-start');

        const controlBtn = document.querySelectorAll(".offcanvasFkgUpploadControlBtn");
        if (controlBtn) {
            controlBtn.forEach(btn => {
                btn.addEventListener("click", () => {
                    offcanvas.toggle()
                    sqlQuery.resetAll();
                });
            });
        }

        const offcanvasBody = document.querySelector('#offcanvas-fkgupload-start .offcanvas-body');
        if (offcanvasBody) {
            createRoot(offcanvasBody).render(<div className="d-flex flex-column">
                <PhotoAttachManager/>
                <div className="position-sticky bg-white" style={{bottom: "-16px"}}><Upload/></div>
            </div>);
        } else {
            console.error('Offcanvas body not found');
        }
    }
};


