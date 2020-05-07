/*  foo.c
 *
 *  This is a fake extension.  It won't actually be compiled.
 */

#include <Python.h>

static PyMethodDef foo_methods[] = {
    {NULL, NULL}
};

void
initfoo(void)
{
    Py_InitModule("foo", foo_methods)
}
