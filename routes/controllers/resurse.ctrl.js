require('dotenv').config();

/* === LIVRESQ - CONNECTOR === */
const LivresqConnect = require('../../models/livresq-connect').LivresqConnect;

/* === DEPENDINȚE === */
const moment = require('moment');
/* === MODELE === */
const Resursa = require('../../models/resursa-red'); // Adu modelul resursei
/* === HELPERE === */
// Cere helperul `checkRole` cu care verifică dacă există rolurile necesare accesului
let checkRole     = require('./checkRole.helper');
let content2html  = require('./editorJs2HTML');
// cere helperul pentru cache-ing
require('./cache.helper');
const {clearHash} = require('./cache.helper');
let cookieHelper  = require('./cookie2obj.helper');

/* === AFIȘAREA RESURSELOR :: /resurse === */
exports.loadRootResources = function loadRootResources (req, res, next) {
    // Indexul de căutare
    let idxRes = process.env.RES_IDX_ALS;

    // ACL
    let roles = ["user", "validator", "cred"];

    // Constituie un array cu rolurile care au fost setate pentru sesiunea în desfășurare. Acestea vin din coockie-ul clientului.
    let confirmedRoles = checkRole(req.session.passport.user.roles.rolInCRED, roles); 
    // console.log("Am următoarele roluri (resurse.ctrl) din req.session.passport: ", req.session.passport.user.roles.rolInCRED);

    // Adu-mi ultimele 8 resursele validate în ordinea ultimei intrări, te rog! Hey, hey, Mr. Serverman!        
    // let resursePublice = Resursa.find({'expertCheck': 'true'}).sort({"date": -1}).limit(8).cache({key: req.user.id});
    let resursePublice = Resursa.find({'expertCheck': 'true'}).sort({"date": -1}).limit(8);
    // let promiseResPub  = resursePublice.exec();

    // SCRIPTURI
    let scripts = [       
        // MOMENT.JS
        {script: '/lib/npm/moment-with-locales.min.js'},
        // HOLDER.JS
        {script: '/lib/npm/holder.min.js'},
    ];

    let modules = [
        // LOCALE
        {script: '/js/redincredall.mjs'} 
    ];
    
    /* === VERIFICAREA CREDENȚIALELOR === */
    if(req.session.passport.user.roles.admin){
        // promiseResPub.then((result) => {
        resursePublice.then((result) => {
            let newResultArr = result.map(function clbkMapResult (obi) {
                const newObi = Object.assign({}, obi._doc); // Necesar pentru că: https://stackoverflow.com/questions/59690923/handlebars-access-has-been-denied-to-resolve-the-property-from-because-it-is
                // https://github.com/wycats/handlebars.js/blob/master/release-notes.md#v460---january-8th-2020
                newObi.dataRo = moment(obi.date).locale('ro').format('LLL');
                // newResultArr.push(newObi);
                return newObi;
            });
            res.render('resurse', {
                title:        "CRED RED",
                user:         req.user,
                logoimg:      "img/rED-logo192.png",
                csrfToken:    req.csrfToken(),
                resurse:      newResultArr,
                activeResLnk: true,
                resIdx:       idxRes,
                scripts,
                modules
            });
        }).catch((err) => {
            if (err) {
                console.log(JSON.stringify(err.body, null, 2));
            }
        });
    } else if (confirmedRoles.length > 0) { // când ai cel puțin unul din rolurile menționate în roles, ai acces la formularul de trimitere a resursei.
        // promiseResPub.then((result) => {
        resursePublice.then(function (result) {
            let newResultArr = result.map(function clbkMapResult (obi) {
                const newObi = Object.assign({}, obi._doc); // Necesar pentru că: https://stackoverflow.com/questions/59690923/handlebars-access-has-been-denied-to-resolve-the-property-from-because-it-is
                // https://github.com/wycats/handlebars.js/blob/master/release-notes.md#v460---january-8th-2020
                newObi.dataRo = moment(obi.date).locale('ro').format('LLL');
                // newResultArr.push(newObi);
                return newObi;
            });
        
            res.render('resurse', {
                title:        "Resurse publice",
                user:         req.user,
                logoimg:      "img/rED-logo192.png",
                csrfToken:    req.csrfToken(),                
                resurse:      newResultArr,
                activeResLnk: true,
                resIdx:       idxRes,
                scripts
            });
        }).catch((err) => {
            if (err) {
                console.log(JSON.stringify(err.body, null, 2));
            }
        });
    } else {
        res.redirect('/401');
    }
    // console.log(req.session.passport.user.roles); // { rolInCRED: [], unit: [], admin: true }
};

/* AFIȘAREA UNEI SINGURE RESURSE / ȘTERGERE / EDITARE */
exports.loadOneResource = function loadOneResource (req, res, next) {
    // console.log(req.params);
    // var record = require('./resincredid.ctrl')(req.params); // aduce resursa și transformă conținutul din JSON în HTML
    let query = Resursa.findById(req.params.id).populate({path: 'competenteS'});
    query.then( (resursa) => {
            if (resursa.id) {
                // transformă obiectul document de Mongoose într-un obiect normal.
                const obi = Object.assign({}, resursa._doc); // Necesar pentru că: https://stackoverflow.com/questions/59690923/handlebars-access-has-been-denied-to-resolve-the-property-from-because-it-is

                // obiectul competenței specifice cu toate datele sale trebuie curățat.
                obi.competenteS = obi.competenteS.map(obi => {
                    return Object.assign({}, obi._doc);
                });

                // adaug o nouă proprietate la rezultat cu o proprietate a sa serializată [injectare în client a întregii înregistrări serializate]
                obi.editorContent = JSON.stringify(resursa);

                // resursa._doc.content = editorJs2html(resursa.content);
                let localizat = moment(obi.date).locale('ro').format('LLL');
                // resursa._doc.dataRo  = `${localizat}`; // formatarea datei pentru limba română.
                obi.dataRo  = `${localizat}`; // formatarea datei pentru limba română.            

                // Array-ul activităților modificat
                let activitatiRehashed = obi.activitati.map((elem) => {
                    let sablon = /^([aA-zZ])+\d/g;
                    let cssClass = elem[0].match(sablon);
                    let composed = '<span class="' + cssClass[0] + 'data-code="' + elem[0] + '">' + elem[1] + '</span>';
                    return composed;
                });
                
                obi.activitati = activitatiRehashed;
                return obi;
            } else {
                console.log(`Nu a putut fi adusă resursa!`);
            }
            return Object.assign({}, resursa._doc);// Necesar pentru că: https://stackoverflow.com/questions/59690923/handlebars-access-has-been-denied-to-resolve-the-property-from-because-it-is
        }).then(result => {
            let scripts = [
                // MOMENT.JS
                {script: '/lib/npm/moment-with-locales.min.js'},
                // EDITOR.JS
                {script: '/lib/editorjs/editor.js'},
                {script: '/lib/editorjs/header.js'},
                {script: '/lib/editorjs/paragraph.js'},
                {script: '/lib/editorjs/list.js'},
                {script: '/lib/editorjs/image.js'},
                {script: '/lib/editorjs/table.js'},
                {script: '/lib/editorjs/attaches.js'},
                {script: '/lib/editorjs/embed.js'},
                {script: '/lib/editorjs/code.js'},
                {script: '/lib/editorjs/quote.js'},
                {script: '/lib/editorjs/inlinecode.js'},
                // HOLDER.JS
                {script: '/lib/npm/holder.min.js'},                
                // UPLOADER
                // {script: '/js/uploader.js'}      
            ];

            let modules = [
                // LOCALS
                {module: '/js/uploader.js'},
                // LOCAL 
                {module: '/js/cred-res.js'}                
            ];

            res.render('resursa-cred', {                
                title:     "RED in CRED",
                user:      req.user,
                logoimg:   "/img/red-logo-small30.png",
                credlogo:  "../img/CREDlogo.jpg",
                csrfToken: req.csrfToken(),
                resursa:   result,
                modules,
                scripts
            });
        }).catch(err => {
            if (err) {
                console.log(JSON.stringify(err.body, null, 2));
            }
        });
};

/* FORM DESCRIERE RESURSE (ADAUGĂ) */
exports.describeResource = function describeResource (req, res, next) {
    const cookieObj = cookieHelper.cock2obj(req.headers.cookie);
    
    // console.log("Sesiunea de la /resurse/adaugă arată așa: ", req.session);
    // pentru evitarea dependițelor din CDN-uri, se vor încărca dinamic scripturile necesare generării editorului
    let scripts = [
        // Datatables
        {script: '/lib/npm/jquery.dataTables.min.js'},
        {script: '/lib/npm/dataTables.bootstrap4.min.js'},
        {script: '/lib/npm/dataTables.select.min.js'},
        {script: '/lib/npm/dataTables.buttons.min.js'},
        {script: '/lib/npm/dataTables.responsive.min.js'},        
        // UPLOADER
        // {script: '/js/uploader.js'},
        // HELPER DETECT URLS or PATHS
        {script: '/js/check4url.js'},
        // EDITOR.JS
        // {script: '/lib/editorjs/attaches.js'},
        // DEPENDIȚELE FORM-ului
        {script: '/js/custom.js'},
    ];

    let modules = [
        // MOTORUL FORM-ULUI
        {module: '/js/form01adres.mjs'},
        // MAIN
        {module: '/js/main.mjs'},        
        // LOCALS
        {module: '/js/uploader.js'}
    ];

    let styles = [
        // FONTAWESOME
        {style: '/lib/npm/all.min.css'},
        // JQUERY TOAST
        {style: '/lib/npm/jquery.toast.min.css'},
        // BOOTSTRAP
        {style: '/lib/npm/bootstrap.min.css'},
        // DATATABLES
        {style: '/lib/npm/jquery.dataTables.min.css'},
        {style: '/lib/npm/buttons.dataTables.min.css'},
        {style: '/lib/npm/dataTables.bootstrap4.min.css'},
        {style: '/lib/npm/responsive.dataTables.min.css'},
        {style: '/lib/npm/select.dataTables.min.css'}
    ];

    // roluri pe care un cont le poate avea în proiectul CRED.
    let roles = ["user", "cred", "validator"];
    let confirmedRoles = checkRole(req.session.passport.user.roles.rolInCRED, roles);
    // console.log(req.session.passport.user.roles.rolInCRED);

    /* === VERIFICAREA CREDENȚIALELOR === */
    if(req.session.passport.user.roles.admin){
        let user = req.session.passport.user;
        // FIXME: Renunță la acest artificiu pentru conturile locale de îndată ce unifici localele cu profilurile Google.
        let given_name =  "Jane" || user.googleProfile.given_name;
        let family_name = "Doe"  || user.googleProfile.family_name;
        
        /* === LIVRESQ CONNECTOR === */
        let url = new LivresqConnect().prepareProjectRequest(user.email, given_name, family_name);
        if(!url.startsWith("http")) url = "#";

        // Dacă avem un admin, atunci oferă acces neîngrădit
        res.render('adauga-res', {            
            title:   "Adauga",
            user:    req.user,
            // style:   "/lib/fontawesome/css/fontawesome.min.css",
            logoimg: "red-logo-small30.png",
            credlogo:"/img/CREDlogo.jpg",
            csrfToken: req.csrfToken(),
            styles,
            modules,
            scripts,
            livresqProjectRequest: url /* === LIVRESQ CONNECTOR === */
        });
        // trimite informații despre user care sunt necesare formularului de încărcare pentru autocompletare
    } else if (confirmedRoles.length > 0) { // când ai cel puțin unul din rolurile menționate în roles, ai acces la formularul de trimitere al resursei.
        
        let user = req.session.passport.user;
        // FIXME: Introdu în formularul de creare cont câmpurile name și surname pentru a elimina artificiul făcut pentru integrarea cu Livresq
        let given_name = 'Jane' || user.googleProfile.given_name;
        let family_name = 'Doe' || user.googleProfile.family_name;
        
        /* === LIVRESQ CONNECTOR === */
        let url = new LivresqConnect().prepareProjectRequest(user.email, given_name, family_name);
        if(!url.startsWith("http")) url = "#";

        res.render('adauga-res', {            
            title:   "Adauga",
            user:    req.user,
            logoimg: "/img/rED-logo192.png",
            credlogo:"/img/CREDlogo.jpg",
            csrfToken: req.csrfToken(),
            styles,
            modules,
            scripts,
            livresqProjectRequest: url /* === LIVRESQ CONNECTOR === */
        });
    } else {
        res.redirect('/401');
    }
};

/* ÎNCĂRCAREA RESURSELOR (inactiv) */
exports.uploadResource = function uploadResource (req, res, next) {
    let roles = ["user", "educred", "validator"];

    let confirmedRoles = checkRole(req.session.passport.user.roles.rolInCRED, roles);

    if (Object.keys(req.files).length == 0) {
        return res.status(400).send('Nu s-a încărcat nimic.');
    }

    /* === VERIFICAREA CREDENȚIALELOR === */
    if(req.session.passport.user.roles.admin){
        // Dacă avem un admin, atunci oferă acces neîngrădit
        // putFilesInBag(req.files, req.body);
        let data = [];
        req.files.forEach((imagine) => {
            // console.log(Object.keys(imagine[key]));
            let img = req.files.imagine[key];
            img.mv('./repo/' + img.name);

            data.push({
                name: img.name,
                mimetype: img.mimetype,
                size: img.size
            });
        });
        res.send({
            status: true,
            message: 'Files are uploaded',
            data: data
        });

    } else if (confirmedRoles.length > 0) {
        // când ai cel puțin unul din rolurile menționate în roles, ai acces la formularul de trimitere a resursei.

    } else {
        res.redirect('/401');
    }
};
