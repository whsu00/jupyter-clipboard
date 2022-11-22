define([
    'base/js/namespace',
    'base/js/events',
], function (
    Jupyter,
    events,
) {
    // forked from njwhite/jupyter-clipboard and conceptualio/copydf

    function copyToClipboard(text) {
        if (window.navigator.clipboard && window.navigator.clipboard.writeText) {
            return window.navigator.clipboard.writeText(text);
        } else if (window.clipboardData && window.clipboardData.setData) {
            return window.clipboardData.setData('text', text);
        } else if (window.document.queryCommandSupported && document.queryCommandSupported('copy')) {
            var textarea = window.document.createElement('textarea');
            textarea.textContent = text;
            textarea.style.position = 'fixed';
            window.document.body.appendChild(textarea);
            textarea.select();
            try {
                return document.execCommand('copy');
            }
            catch (e) {
                console.error('Copy to clipboard failed.', ex);
                return false;
            }
            finally {
                window.document.body.removeChild(textarea);
            }
        } else {
            console.error('cannot copy to clipboard', text);
        }
    }

    function pyperclip() {
        function handle_msg(msg) {
            // Jupyter will try to copy the current cell instead of a hidden text area
            // unless we disable its keyboard_manager hijacking
            Jupyter.notebook.keyboard_manager.disable()
            copyToClipboard(msg)
            Jupyter.notebook.keyboard_manager.enable();
            Jupyter.notebook.keyboard_manager.command_mode();
            if (cell = Jupyter.notebook.get_selected_cell()) {
                cell.select();
            }
        }

        console.debug('registering clipboard')
        Jupyter.notebook.kernel.comm_manager.register_target(
            'jupyter-pyperclip',
            (comm, msg) => comm.on_msg(handle_msg)
        );
        console.debug('registering clipboard...done')

        console.debug('installing pyperclip hook')
        callbacks = {
            shell: {
                reply: (e) => console.log('Installing pyperclip.copy: ' + e.content.status)
            },
            iopub: {
                output: (e) => console.log(e)
            }
        }
        Jupyter.notebook.kernel.execute(`
from ipykernel.comm import Comm

comm = Comm(target_name='jupyter-pyperclip')
def copy(x):
    comm.send(x)

try:
    import pyperclip
    pyperclip.copy = copy
except ImportError:
    pass

try:
    import pandas.io.clipboard  # has its own fork of pyperclip
    pandas.io.clipboard.copy = copy
    pandas.io.clipboard.clipboard_set = copy
except ImportError:
    pass
`,
        callbacks);
    }

    function setup(was_delayed) {
        console.log('running jupyter-pyperclip setup, delayed=' + was_delayed)

        // install the hook server-side *after* we've registered the client-side
        // hook, and trigger now if the kernel is already alive!
        console.debug('installing hook')
        if (Jupyter.notebook.kernel !== undefined && Jupyter.notebook.kernel !== null) {
            pyperclip();
        }
        events.on('kernel_ready.Kernel', pyperclip)
    }

    function load_ipython_extension() {
        if (Jupyter.notebook._fully_loaded) {
            console.debug('notebook _fully_loaded, starting setup')
            setup(false);
        } else {
            events.on('notebook_loaded.Notebook', function() {
                setup(true);
            })
        }

    }

    return {
        load_ipython_extension: load_ipython_extension
    };
});
